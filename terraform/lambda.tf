data "archive_file" "backend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend.zip"
  excludes    = ["node_modules", "src", "tsconfig.json", "package.json", "package-lock.json", ".git"]
}

locals {
  lambda_env_vars = {
    INPUT_BUCKET          = aws_s3_bucket.input.id
    OUTPUT_BUCKET         = aws_s3_bucket.output.id
    DYNAMODB_TABLE        = aws_dynamodb_table.jobs.name
    USERS_TABLE           = aws_dynamodb_table.users.name
    PAYMENTS_TABLE        = aws_dynamodb_table.payments.name
    STRIPE_SECRET_KEY     = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
    FREE_CONVERSIONS      = var.free_conversions_count
    PRICE_PER_CONVERSION  = var.price_per_conversion_inr
    MAX_FILE_SIZE_MB      = var.max_file_size_mb
    MEDIACONVERT_ROLE_ARN = aws_iam_role.mediaconvert.arn
    MEDIACONVERT_ENDPOINT = data.aws_media_convert_queue.default.arn
    CLOUDFRONT_DOMAIN     = aws_cloudfront_distribution.cdn.domain_name
  }
}

resource "aws_lambda_function" "get_upload_url" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "get-upload-url"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/get-upload-url/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "convert" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "convert"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/convert/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "get_job_status" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "get-job-status"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/get-job-status/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "s3_trigger" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "s3-trigger"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/s3-trigger/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

# S3 event notification
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_trigger.arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.input.arn
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.input.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.s3_trigger.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "input-videos/"
    filter_suffix       = ".mp4"
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

resource "aws_lambda_function" "webhook" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "mediaconvert-webhook"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/mediaconvert-webhook/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

# EventBridge rule for MediaConvert to trigger Lambda Webhook
resource "aws_cloudwatch_event_rule" "mediaconvert_status" {
  name        = "mediaconvert-status-rule"
  description = "Trigger lambda when MediaConvert job completes or fails"

  event_pattern = jsonencode({
    source = ["aws.mediaconvert"]
    detail-type = ["MediaConvert Job State Change"]
  })
}

resource "aws_cloudwatch_event_target" "trigger_lambda_on_mc_status" {
  rule      = aws_cloudwatch_event_rule.mediaconvert_status.name
  target_id = "TriggerMediaConvertWebhookLambda"
  arn       = aws_lambda_function.webhook.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook.arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.mediaconvert_status.arn
}

resource "aws_lambda_function" "cognito_post_confirmation" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "cognito-post-confirmation"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/cognito-post-confirmation/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "get_user_profile" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "get-user-profile"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/get-user-profile/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "create_checkout_session" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "create-checkout-session"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/create-checkout-session/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}

resource "aws_lambda_function" "stripe_webhook" {
  filename         = data.archive_file.backend_zip.output_path
  function_name    = "stripe-webhook"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "dist/functions/stripe-webhook/index.handler"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  runtime          = "nodejs18.x"
  
  environment {
    variables = local.lambda_env_vars
  }
}
