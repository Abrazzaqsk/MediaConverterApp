variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "input_bucket_name" {
  description = "Name of the input S3 bucket"
  type        = string
  default     = "mc-input-bucket-2026-video"
}

variable "output_bucket_name" {
  description = "Name of the output S3 bucket"
  type        = string
  default     = "mc-output-bucket-2026-video"
}

variable "dynamodb_table_name" {
  description = "Job Status DynamoDB table"
  type        = string
  default     = "VideoConversionJobs"
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = ["*"]
}

variable "retention_days" {
  description = "Number of days to keep segments in output bucket"
  type        = number
  default     = 30
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key"
  type        = string
  default     = "sk_test_123"
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Secret"
  type        = string
  default     = "whsec_123"
}

variable "free_conversions_count" {
  description = "Number of free conversions for new users"
  type        = number
  default     = 3
}

variable "price_per_conversion_inr" {
  description = "Cost of paid conversions in INR"
  type        = number
  default     = 15
}

variable "max_file_size_mb" {
  description = "Max file size in MB"
  type        = number
  default     = 500
}
