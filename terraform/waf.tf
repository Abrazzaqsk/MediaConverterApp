resource "aws_wafv2_web_acl" "api_waf" {
  name        = "video-converter-api-waf"
  description = "WAF for Video Converter API"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 100
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "video-converter-api-waf"
    sampled_requests_enabled   = true
  }
}

# AWS WAF integration requires a regional web ACL mapped directly to the API Gateway.
# WAFv2 Association is done via aws_wafv2_web_acl_association but ApiGatewayV2 requires special treatment 
# often mapped to the stage ARN
resource "aws_wafv2_web_acl_association" "api_waf_assoc" {
  resource_arn = aws_apigatewayv2_stage.api.arn
  web_acl_arn  = aws_wafv2_web_acl.api_waf.arn
}
