# MediaConvert SaaS

A fully serverless, production-ready SaaS for converting videos to HLS built with AWS Elemental MediaConvert, React, and Node.js.

## Architecture

* **Frontend**: React (Vite) + Tailwind CSS + AWS Amplify UI.
* **Backend**: Express (Local Dev) / AWS Lambda + API Gateway (Prod).
* **Billing Engine**: Tier-based robust billing per minute.
* **Storage**: Amazon S3 (Prod) / Local mock S3 (Dev).
* **Database**: Amazon DynamoDB.

## SaaS Business Logic & Pricing Engine

* **Free Tier**: 3 free conversions (up to 500MB each) using single-bitrate 720p HLS.
* **Paid Credits Tier Scaling**:
   * 0–5 min: ₹10 per minute
   * 5–20 min: ₹8 per minute
   * 20+ min: ₹6 per minute
* **Total Conversion Calculation**: Probes video duration prior to conversion, rounds up to nearest minute natively via `PricingEngine` and automatically checks credit applicability.

## How to run locally on MacBook (Dev Mode)

A fully isolated local development mode enables testing workflows without incurring any AWS MediaConvert, S3, or API Gateway costs. It achieves this using a pre-packaged Express server and FFmpeg.

### 1. Prerequisites
- Docker & Docker Compose
- Node.js v18+

### 2. Start the Local Backend
The backend utilizes a LocalFFmpegService inside the Docker container to mock AWS MediaConvert.

\```bash
docker-compose up backend
\```
*This starts the Express server on `http://localhost:3000`. It automatically mounts `./local-storage` where videos will be uploaded and output.*

### 3. Start the Local Frontend
Open a new terminal tab and start the React frontend:

\```bash
cd frontend
cp .env.example .env.local
# Edit .env.local to set VITE_API_URL=http://localhost:3000
npm install
npm run dev
\```

### 4. Local Testing Workflow
1. Browse to `http://localhost:5173`
2. **LogIn / Sign Up**: (Uses AWS Cognito or Mock User natively via backend).
3. **Upload**: Select an MP4 file. The frontend locally generates a probe and determines the tier and price.
4. **Convert**: Click Convert. The backend `dev-server.ts` accepts the mock `/convert` POST request.
5. **Local Processing**: Instead of dispatching `MediaConvertService`, the `LocalFFmpegService` seamlessly activates and renders HLS inside `local-storage/output/`.
6. **Playback**: Review your generated `master.m3u8` directly.

## Production Mode Deployment

When switching to production, the `NODE_ENV` switches automatically to `production`.

### 1. Terraform Deployment
\```bash
cd terraform
terraform init
terraform apply
\```
The backend zip will inherently exclude local-dev dependencies but relies natively on `MediaConvertService` targeting your configured `AWS_REGION` utilizing your `tfvars`. Ensure the `stripe` bindings and DB roles are correctly provided!
