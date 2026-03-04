data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "mediaconvert_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["mediaconvert.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "video-converter-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role" "mediaconvert" {
  name               = "video-converter-mediaconvert-role"
  assume_role_policy = data.aws_iam_policy_document.mediaconvert_assume_role.json
}

data "aws_iam_policy_document" "lambda_policy" {
  # Logs
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }

  # S3
  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.input.arn,
      "${aws_s3_bucket.input.arn}/*",
      aws_s3_bucket.output.arn,
      "${aws_s3_bucket.output.arn}/*"
    ]
  }

  # DynamoDB
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:Scan"
    ]
    resources = [
      aws_dynamodb_table.jobs.arn,
      aws_dynamodb_table.users.arn,
      aws_dynamodb_table.payments.arn
    ]
  }

  # MediaConvert
  statement {
    actions = [
      "mediaconvert:CreateJob",
      "mediaconvert:GetJob"
    ]
    resources = ["*"]
  }

  # PassRole to MediaConvert
  statement {
    actions = ["iam:PassRole"]
    resources = [aws_iam_role.mediaconvert.arn]
  }
}

resource "aws_iam_policy" "lambda_policy" {
  name   = "video-converter-lambda-policy"
  policy = data.aws_iam_policy_document.lambda_policy.json
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

data "aws_iam_policy_document" "mediaconvert_policy" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "${aws_s3_bucket.input.arn}/*",
      "${aws_s3_bucket.output.arn}/*"
    ]
  }
  
  # For API Gateway to MediaConvert passing role, they need some basic Execute permission though it usually uses AmazonAPIGatewayInvokeFullAccess.
}

resource "aws_iam_policy" "mediaconvert_policy" {
  name   = "video-converter-mediaconvert-policy"
  policy = data.aws_iam_policy_document.mediaconvert_policy.json
}

resource "aws_iam_role_policy_attachment" "mc_policy_attach" {
  role       = aws_iam_role.mediaconvert.name
  policy_arn = aws_iam_policy.mediaconvert_policy.arn
}
