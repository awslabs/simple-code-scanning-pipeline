locals {
    basic_ssm_parameters = {
        resourceId           = ["<resourceId>"],
        AutomationAssumeRole = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/execute-remediation-${var.config_rule_name}"], // ARN is not referenced explicitly so that this can be populated before apply time
    }
    combined_parameters = replace( //Un-escape angle-bracket characters using workaround from https://github.com/hashicorp/terraform/pull/18871
        replace(
            jsonencode(merge(local.basic_ssm_parameters, var.input_template_extra_parameters)),
            "\\u003c",
            "<"
        ),
        "\\u003e",
        ">"
    )
}

resource "aws_cloudwatch_event_rule" "config_rule_non_compliance_rule" {
    name        = "NonCompliantEvaluation-${var.config_rule_name}"
    description = "Non-compliant evaluation for the Config rule ${var.config_rule_name}"
    event_pattern = <<EOP
{
    "source": [
        "aws.config"
    ],
    "detail-type": [
        "AWS API Call via CloudTrail"
    ],
    "detail": {
        "eventName": [
            "PutEvaluations"
        ],
        "eventSource": [
            "config.amazonaws.com"
        ],
        "requestParameters": {
            "evaluations": {
                "complianceType": [
                    "NON_COMPLIANT"
                ],
                "complianceResourceType": [
                    "${var.resource_type}"
                ]
            }
        },
        "additionalEventData": {
            "configRuleName": [
                {
                    "prefix": "${var.config_rule_name}-"
                },
                {
                    "prefix": "OrgConfigRule-${var.config_rule_name}-"
                }
            ]
        }
    }
}
EOP
}

resource "aws_sqs_queue" "dlq" {
    name = "remediation-events-dlq-${var.config_rule_name}"
    // kms_master_key_id = var.kms_key_id // Commented out so that Checkov will complain about unencrypted DLQ
    message_retention_seconds = 345600 # 4 days
}

resource "aws_cloudwatch_event_target" "config_rule_target" {
    rule      = aws_cloudwatch_event_rule.config_rule_non_compliance_rule.name
    target_id = "${aws_cloudwatch_event_rule.config_rule_non_compliance_rule.name}-remediation"
    arn       = "${replace(aws_ssm_document.remediation_document.arn, "document/", "automation-definition/")}"
    role_arn  = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/invoke-remediation-${var.config_rule_name}" // ARN is not referenced explicitly so that this can be deployed in non-home regions without broken references
    input_transformer {
      input_paths = {
        resourceId = "$.detail.requestParameters.evaluations[0].complianceResourceId"
      }
      input_template = local.combined_parameters
    }
    dead_letter_config {
        arn = aws_sqs_queue.dlq.arn
    }
}

resource "aws_ssm_document" "remediation_document" {
    name = "Remediate-${var.config_rule_name}"
    document_type = "Automation"
    document_format = "YAML"
    content = var.ssm_automation_document_content
}

resource "aws_iam_role" "execute_automation_document" {
    count = data.aws_region.current.name == var.home_region ? 1 : 0
    name = "execute-remediation-${var.config_rule_name}"
    assume_role_policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
        {
            Action = "sts:AssumeRole"
            Effect = "Allow"
            Sid    = ""
            Principal = {
            Service = "ssm.amazonaws.com"
            }
        },
        ]
    })
    managed_policy_arns = [
        "arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole",
        "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs" // Note: this is a non-standard service using this policy, but the actions cover what we want to send
    ]
    inline_policy {
        name = "AutomationExecutionPolicies"
        policy = data.aws_iam_policy_document.automation_document_policies.json
    } 
}

resource "aws_iam_role" "invoke_automation_document" {
    count = data.aws_region.current.name == var.home_region ? 1 : 0
    name = "invoke-remediation-${var.config_rule_name}"
    assume_role_policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
            {
                Action = "sts:AssumeRole"
                Effect = "Allow"
                Sid    = ""
                Principal = {
                    Service = "events.amazonaws.com"
                }
            },
        ]
    })
    description = "The role that will be used by AWS EventBridge to start an SSM Run Command document."
    inline_policy { 
      name = "RunAutomationDoc"
      policy = jsonencode({   
            Version = "2012-10-17"
            Statement = [
                {
                    Action = "ssm:StartAutomationExecution"
                    Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:automation-definition/${aws_ssm_document.remediation_document.name}:$DEFAULT"
                    Effect = "Allow"
                },
                {
                    Action = "iam:PassRole"
                    Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/execute-remediation-${var.config_rule_name}" // ARN is not referenced explicitly so that this can be deployed in non-home regions without broken references
                    Effect = "Allow"
                    Condition = {
                        StringLikeIfExists = {
                            "iam:PassedToService" = "ssm.amazonaws.com"
                        }
                    }
                }
            ]
        })
    }
}

