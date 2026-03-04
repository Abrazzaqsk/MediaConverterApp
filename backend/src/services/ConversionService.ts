import { LocalFFmpegService } from './LocalFFmpegService';
import { MediaConvertService } from './MediaConvertService';

export class ConversionService {
    private localFfmpeg: LocalFFmpegService;
    private mediaConvert: MediaConvertService | null = null;

    constructor() {
        this.localFfmpeg = new LocalFFmpegService();

        if (process.env.NODE_ENV !== 'development') {
            this.mediaConvert = new MediaConvertService();
        }
    }

    public async getDuration(filePathOrUrl: string): Promise<number> {
        try {
            if (process.env.NODE_ENV === 'development') {
                return await this.localFfmpeg.probeDuration(filePathOrUrl);
            } else {
                // In production, we assume we use a tool like MediaInfo or ffmpeg Layer.
                // Since deployment packaging may lack ffprobe binary, we can fallback gracefully 
                // or assume duration passes via signed URL probe.
                try {
                    return await this.localFfmpeg.probeDuration(filePathOrUrl);
                } catch (e) {
                    console.warn("Probe failed, defaulting to 10 min for billing:", e);
                    return 600; // 10 minutes default if probe not available in stripped lambda
                }
            }
        } catch (e) {
            console.error("Error getting duration:", e);
            return 600; // fall back to 10 minutes
        }
    }

    public async startConversion(
        inputPath: string,
        outputPrefix: string,
        profile: 'single' | 'adaptive',
        userMetadata: Record<string, string>
    ): Promise<string> {
        if (process.env.NODE_ENV === 'development') {
            // Async convert local
            this.localFfmpeg.convertToHls(inputPath, outputPrefix, profile)
                .then(() => {
                    console.log(`[Local DEV] HLS Generation complete for ${outputPrefix}`);
                })
                .catch(console.error);

            return `local-job-${Date.now()}`;
        } else {
            if (!this.mediaConvert) throw new Error("MediaConvert service uninitialized");
            return await this.mediaConvert.createJob(
                inputPath,
                outputPrefix,
                userMetadata,
                profile
            ) as string;
        }
    }
}

export const conversionService = new ConversionService();
