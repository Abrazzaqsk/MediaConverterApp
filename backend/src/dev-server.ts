import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
process.env.NODE_ENV = 'development';

import { handler as convertHandler } from './functions/convert/index';

const app = express();
app.use(cors());
app.use(express.json());

const localStoragePath = path.resolve(process.cwd(), '..', 'local-storage');
app.use('/files', express.static(localStoragePath));

['input', 'output'].forEach(folder => {
    const p = path.join(localStoragePath, folder);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.post('/upload-url', (req: Request, res: Response) => {
    const { filename } = req.body;
    const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    res.json({
        uploadUrl: `http://localhost:3000/local-upload/${key}`,
        key,
        bucket: 'local-bucket'
    });
});

app.put('/local-upload/:key', express.raw({ type: '*/*', limit: '1000mb' }), (req: Request, res: Response) => {
    const { key } = req.params;
    const filePath = path.join(localStoragePath, 'input', key);
    fs.writeFileSync(filePath, req.body);
    res.status(200).send('OK');
});

// Mock Price Config per feature request
app.post('/calculate-price', (req: Request, res: Response) => {
    // A mock API to get duration and estimate from frontend
    const { durationSeconds } = req.body;
    const { calculatePrice } = require('./billing/PricingEngine');
    res.json(calculatePrice(durationSeconds));
});

app.post('/convert', async (req: Request, res: Response) => {
    const event = {
        body: req.body,
        requestContext: { authorizer: { jwt: { claims: { sub: 'mock-user-123' } } } }
    };
    const response = await convertHandler(event as any);
    if (response.body) {
        const b = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
        res.status(response.statusCode).json(b);
    } else {
        res.status(response.statusCode).send();
    }
});

// Mock status fetch
app.get('/job-status/:jobId', (req: Request, res: Response) => {
    // In dev, the conversion runs inline synchronously without MediaConvert
    // So if the local job returned success, we can mock the complete status
    res.json({
        jobId: req.params.jobId,
        status: "COMPLETE",
        // Hack: The frontend assumes output URL is what we stream
        // For development, we return local path
        outputUrl: `http://localhost:3000/files/output/${req.params.jobId.includes('-') ? req.query.outputPrefix || 'local' : 'default'}/master.m3u8`
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Development Server running on http://localhost:${PORT}`);
    console.log(`Local Storage served at http://localhost:${PORT}/files/`);
});
