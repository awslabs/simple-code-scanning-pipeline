resource "aws_config_organization_managed_rule" "managed_rule" {
  # depends_on    = [aws_organizations_organization.delegated_admin]
  name = "required_tags_ou_structure" // If there is an associated remediation, it must match this string
  description = "Enforces required tags on EC2 instances"
  rule_identifier = "REQUIRED_TAGS"
  input_parameters = "{\"tag1Key\": \"ouStructure\"}"
  resource_types_scope = [
    "AWS::EC2::Instance"
  ]
  # maximum_execution_frequency = One_Hour
}