import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

// Fix for strict TypeScript imports and require
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export class LocalFFmpegService {
    public async probeDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);
                const duration = metadata.format.duration;
                resolve(duration ? parseFloat(duration.toString()) : 0);
            });
        });
    }

    public async convertToHls(inputPath: string, outputPrefix: string, profile: 'single' | 'adaptive'): Promise<string> {
        // Determine absolute folder paths based on local-storage standard
        const localStoragePath = path.resolve(process.cwd(), '..', 'local-storage');
        // Ensure we extract simply the last chunk if outputPrefix is passed weirdly
        // outputPrefix e.g.: users/usr_123/output/myvideo
        const outputFolder = path.join(localStoragePath, "output", outputPrefix);

        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            let command = ffmpeg(inputPath);

            if (profile === 'adaptive') {
                command
                    .complexFilter([
                        '[0:v]split=3[v1][v2][v3]',
                        '[v1]scale=1920:1080[v1out]',
                        '[v2]scale=1280:720[v2out]',
                        '[v3]scale=854:480[v3out]'
                    ])
                    .outputOptions([
                        '-map [v1out]', '-map 0:a?',
                        '-map [v2out]', '-map 0:a?',
                        '-map [v3out]', '-map 0:a?',
                        '-f hls',
                        '-var_stream_map v:0,a:0 v:1,a:0 v:2,a:0',
                        '-master_pl_name master.m3u8',
                        '-hls_time 4'
                    ])
                    .output(path.join(outputFolder, 'output_%v.m3u8'));
            } else {
                command
                    .outputOptions([
                        '-vf scale=1280:720',
                        '-c:v libx264',
                        '-c:a aac',
                        '-f hls',
                        '-hls_time 4'
                    ])
                    .output(path.join(outputFolder, 'index.m3u8')); // For single
            }

            command.on('end', () => resolve('COMPLETE'))
                .on('error', (err) => reject(err))
                .run();
        });
    }
}
