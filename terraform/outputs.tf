output "api_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
  description = "Base URL for the API Gateway"
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
  description = "CloudFront Domain Name for output video delivery"
}

output "input_bucket" {
  value = aws_s3_bucket.input.id
  description = "S3 bucket for input videos"
}

output "output_bucket" {
  value = aws_s3_bucket.output.id
  description = "S3 bucket for output videos"
}

output "mediaconvert_role_arn" {
  value = aws_iam_role.mediaconvert.arn
  description = "IAM Role ARN for MediaConvert"
}
