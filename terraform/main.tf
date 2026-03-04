terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

// Get the MediaConvert ATS endpoint for the current account/region
data "aws_media_convert_queue" "default" {
  id = "Default"
}

locals {
  app_name = "serverless-video-converter"
}
