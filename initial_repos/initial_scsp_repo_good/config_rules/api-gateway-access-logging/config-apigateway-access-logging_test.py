import unittest

##############
# Parameters #
##############

# Define the default resource to report to Config Rules
DEFAULT_RESOURCE_TYPE = "AWS::ApiGateway::Stage"

#############
# Main Code #
#############

RULE = __import__("config-apigateway-access-logging")


class ComplianceTest(unittest.TestCase):

    test1Id = "test_no_settings"
    mock_ci_no_access_log_settings = {
        "resourceType": "AWS::ApiGateway::Stage",
        "resourceId": test1Id,
        "configurationItemCaptureTime": "2021-10-07T04:34:52.542Z",
        "configuration": {
            "stageName": "Dev",
            "restApiId": "test",
        }
    }
    test2Id = "test_correct_settings"
    mock_ci_correct_settings = {
        "resourceType": "AWS::ApiGateway::Stage",
        "resourceId": test2Id,
        "configurationItemCaptureTime": "2021-10-07T04:34:52.542Z",
        "configuration": {
            "stageName": "Dev",
            "restApiId": "test",
            "accessLogSettings": {
                "format": "blah!",  # This is not a valid format, but the Config rule doesn't currently check this.
                "destinationArn": "Blah!"
            }
        }
    }

    def test_sample_1(self):
        self.assertTrue(True)

    def test_mock_response(self):
        response = RULE.evaluate_compliance({}, self.mock_ci_no_access_log_settings, {})
        expected_response = build_expected_response(
            compliance_type="NON_COMPLIANT",
            compliance_resource_id=self.test1Id,
            compliance_resource_type=DEFAULT_RESOURCE_TYPE,
            annotation="AccessLogSettings are not defined for this stage."
        )
        assert_successful_evaluation(self, response, expected_response, len(response))

    def test_compliant_configuration(self):
        response = RULE.evaluate_compliance({}, self.mock_ci_correct_settings, {})
        expected_response = build_expected_response(
            compliance_type="COMPLIANT",  # NON_COMPLIANT
            compliance_resource_id=self.test2Id,
            compliance_resource_type=DEFAULT_RESOURCE_TYPE,
            # annotation="AccessLogSettings Format is invalid - should be JSON-based"
        )
        assert_successful_evaluation(self, response, expected_response, len(response))

####################
# Helper Functions #
####################


def build_lambda_configurationchange_event(invoking_event, rule_parameters=None):
    event_to_return = {
        "configRuleName": "myrule",
        "executionRoleArn": "roleArn",
        "eventLeftScope": False,
        "invokingEvent": invoking_event,
        "accountId": "123456789012",
        "configRuleArn": "arn:aws:config:us-east-1:123456789012:config-rule/config-rule-8fngan",
        "resultToken": "token",
    }
    if rule_parameters:
        event_to_return["ruleParameters"] = rule_parameters
    return event_to_return


def build_lambda_scheduled_event(rule_parameters=None):
    invoking_event = '{"messageType":"ScheduledNotification","notificationCreationTime":"2017-12-23T22:11:18.158Z"}'
    event_to_return = {
        "configRuleName": "myrule",
        "executionRoleArn": "roleArn",
        "eventLeftScope": False,
        "invokingEvent": invoking_event,
        "accountId": "123456789012",
        "configRuleArn": "arn:aws:config:us-east-1:123456789012:config-rule/config-rule-8fngan",
        "resultToken": "token",
    }
    if rule_parameters:
        event_to_return["ruleParameters"] = rule_parameters
    return event_to_return


def build_expected_response(
    compliance_type,
    compliance_resource_id,
    compliance_resource_type=DEFAULT_RESOURCE_TYPE,
    annotation=None,
):
    if not annotation:
        return {
            "ComplianceType": compliance_type,
            "ComplianceResourceId": compliance_resource_id,
            "ComplianceResourceType": compliance_resource_type,
        }
    return {
        "ComplianceType": compliance_type,
        "ComplianceResourceId": compliance_resource_id,
        "ComplianceResourceType": compliance_resource_type,
        "Annotation": annotation,
    }


def assert_successful_evaluation(
    test_class, response, resp_expected, evaluations_count=1
):
    if isinstance(response, dict):
        test_class.assertEquals(
            resp_expected["ComplianceResourceType"], response["ComplianceResourceType"]
        )
        test_class.assertEquals(
            resp_expected["ComplianceResourceId"], response["ComplianceResourceId"]
        )
        test_class.assertEquals(
            resp_expected["ComplianceType"], response["ComplianceType"]
        )
        test_class.assertTrue(response["OrderingTimestamp"])
        if "Annotation" in resp_expected or "Annotation" in response:
            test_class.assertEquals(resp_expected["Annotation"], response["Annotation"])
    elif isinstance(response, list):
        test_class.assertEquals(evaluations_count, len(response))
        for i, response_expected in enumerate(resp_expected):
            test_class.assertEquals(
                response_expected["ComplianceResourceType"],
                response[i]["ComplianceResourceType"],
            )
            test_class.assertEquals(
                response_expected["ComplianceResourceId"],
                response[i]["ComplianceResourceId"],
            )
            test_class.assertEquals(
                response_expected["ComplianceType"], response[i]["ComplianceType"]
            )
            test_class.assertTrue(response[i]["OrderingTimestamp"])
            if "Annotation" in response_expected or "Annotation" in response[i]:
                test_class.assertEquals(
                    response_expected["Annotation"], response[i]["Annotation"]
                )


def assert_customer_error_response(
    test_class, response, customer_error_code=None, customer_error_message=None
):
    if customer_error_code:
        test_class.assertEqual(customer_error_code, response["customerErrorCode"])
    if customer_error_message:
        test_class.assertEqual(customer_error_message, response["customerErrorMessage"])
    test_class.assertTrue(response["customerErrorCode"])
    test_class.assertTrue(response["customerErrorMessage"])
    if "internalErrorMessage" in response:
        test_class.assertTrue(response["internalErrorMessage"])
    if "internalErrorDetails" in response:
        test_class.assertTrue(response["internalErrorDetails"])


if __name__ == '__main__':
    unittest.main()
