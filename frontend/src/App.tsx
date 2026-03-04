import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';

// Initialize Amplify
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
            userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
            identityPoolId: '',
        }
    }
});

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function LandingPage() {
    return (
        <div className="flex flex-col items-center py-20 px-4 text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 pb-4">
                Convert Video with Zero Wait Time
            </h1>
            <p className="mt-6 text-xl text-slate-300 max-w-2xl">
                The ultimate serverless video conversion SaaS. Get 3 conversions entirely for free.
                No credit card required. Only ₹15 thereafter.
            </p>
            <div className="mt-10 flex gap-4 justify-center">
                <Link to="/app" className="py-4 px-8 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full font-bold shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform">
                    Start for Free
                </Link>
                <Link to="/pricing" className="py-4 px-8 bg-slate-800 rounded-full font-bold hover:bg-slate-700 transition">
                    View Pricing
                </Link>
            </div>
        </div>
    );
}

function PricingPage() {
    return (
        <div className="py-20 px-4 text-center max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-12">Simple, Transparent Pricing</h2>
            <div className="grid md:grid-cols-2 gap-8">
                <div className="p-8 rounded-2xl glass-panel relative overflow-hidden text-left border-blue-500/50 border">
                    <div className="absolute top-0 right-0 bg-blue-500 text-xs font-bold px-3 py-1 rounded-bl-lg text-white">Most Popular</div>
                    <h3 className="text-2xl font-bold text-white mb-2">Free Tier</h3>
                    <p className="text-slate-400 mb-6">Perfect to test out the service.</p>
                    <div className="text-4xl font-extrabold mb-6">₹0 <span className="text-lg text-slate-500 font-normal">/ 3 conversions</span></div>
                    <ul className="space-y-3 mb-8 text-slate-300">
                        <li className="flex items-center gap-2"><span>✅</span> Up to 500MB per file</li>
                        <li className="flex items-center gap-2"><span>✅</span> Single Bitrate Output (720p)</li>
                        <li className="flex items-center gap-2"><span>✅</span> Global CDN delivery</li>
                    </ul>
                    <Link to="/app" className="block text-center py-3 w-full bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">Try Now</Link>
                </div>
                <div className="p-8 rounded-2xl glass-panel text-left">
                    <h3 className="text-2xl font-bold text-emerald-400 mb-2">Pay As You Go</h3>
                    <p className="text-slate-400 mb-6">For professionals and bulk needs.</p>
                    <div className="text-4xl font-extrabold mb-6">₹15 <span className="text-lg text-slate-500 font-normal">/ conversion</span></div>
                    <ul className="space-y-3 mb-8 text-slate-300">
                        <li className="flex items-center gap-2"><span>✅</span> Adaptive Bitrate (1080p, 720p, 480p)</li>
                        <li className="flex items-center gap-2"><span>✅</span> Priority Processing</li>
                        <li className="flex items-center gap-2"><span>✅</span> No watermark</li>
                    </ul>
                    <Link to="/app" className="block text-center py-3 w-full bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold">Buy Credits</Link>
                </div>
            </div>
        </div>
    );
}

function Dashboard() {
    const [file, setFile] = useState<File | null>(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [jobId, setJobId] = useState('');
    const [jobStatus, setJobStatus] = useState<any>(null);
    const [priceEstimate, setPriceEstimate] = useState<any>(null);

    const calculatePriceLocal = (durationSeconds: number) => {
        const roundedMinutes = Math.ceil(durationSeconds / 60) || 1;
        let pricePerMinute = 10;
        let tier = "0-5 min";
        if (roundedMinutes > 20) { pricePerMinute = 6; tier = "20+ min"; }
        else if (roundedMinutes > 5) { pricePerMinute = 8; tier = "5-20 min"; }
        setPriceEstimate({ roundedMinutes, pricePerMinute, totalPrice: roundedMinutes * pricePerMinute, tier });
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const session = await fetchAuthSession();
            const res = await fetch(`${API_BASE}/user-profile`, {
                method: "GET",
                headers: { "Authorization": session.tokens?.idToken?.toString() || "" }
            });
            setUserProfile(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const handleBuyCredits = async (conversions: number) => {
        try {
            const session = await fetchAuthSession();
            setStatusMsg("Redirecting to checkout...");
            const res = await fetch(`${API_BASE}/create-checkout-session`, {
                method: "POST",
                headers: {
                    "Authorization": session.tokens?.idToken?.toString() || "",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ conversions })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUploadAndConvert = async () => {
        if (!file) return alert("Select a file first");
        setStatusMsg("Validating...");

        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString() || "";

            setStatusMsg("Getting secure upload URL...");
            // 1. Get Presigned URL
            let res = await fetch(`${API_BASE}/upload-url`, {
                method: "POST",
                headers: { "Authorization": token, "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, contentType: file.type })
            });
            let data = await res.json();
            if (!data.uploadUrl) return setStatusMsg("Failed to get upload URL");

            const { uploadUrl, key, bucket } = data;

            setStatusMsg("Uploading...");
            // 2. Upload file directly to S3
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', uploadUrl, true);
                xhr.setRequestHeader('Content-Type', file.type);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
                };
                xhr.onload = () => {
                    if (xhr.status === 200 || xhr.status === 204) resolve(true);
                    else reject(new Error('S3 Upload failed limit potentially exceeded'));
                };
                xhr.onerror = () => reject(new Error('Network error uploading to S3'));
                xhr.send(file);
            });

            setStatusMsg("Upload finished. Starting conversion...");

            // 3. Trigger Conversion API manually (checks limits + billing)
            res = await fetch(`${API_BASE}/convert`, {
                method: "POST",
                headers: { "Authorization": token, "Content-Type": "application/json" },
                body: JSON.stringify({
                    inputBucket: bucket,
                    inputKey: key,
                    outputBucket: import.meta.env.VITE_OUTPUT_BUCKET,
                    outputPrefix: key.replace("input/", "output/").replace(/\.[^/.]+$/, ""),
                    profile: (userProfile?.paid_credits > 0) ? "adaptive" : "single" // Paid gets adaptive
                })
            });

            const convData = await res.json();

            if (res.status === 402) {
                setStatusMsg("You have no credits! Please purchase more.");
            } else if (res.ok) {
                setStatusMsg(`Conversion started! ID: ${convData.jobId}`);
                setJobId(convData.jobId);
                trackJobStatus(convData.jobId, token);
                fetchProfile(); // Refresh profile state
            } else {
                setStatusMsg(`Error: ${convData.error}`);
            }

        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
    };

    const trackJobStatus = async (id: string, token: string) => {
        try {
            const response = await fetch(`${API_BASE}/job-status/${id}`, {
                headers: { "Authorization": token }
            });
            const data = await response.json();
            setJobStatus(data);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-10 px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sidebar / Profile Panel */}
            <div className="glass-panel p-6 rounded-2xl h-fit border border-slate-700">
                <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-700 pb-4">My Account</h2>
                {userProfile ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
                            <span className="text-slate-400">Free Conversions</span>
                            <span className="font-bold text-white">{Math.max(0, 3 - userProfile.free_conversions_used)}/3</span>
                        </div>
                        <div className="flex justify-between items-center bg-emerald-900/30 border border-emerald-500/20 p-3 rounded-lg">
                            <span className="text-emerald-400">Paid Credits</span>
                            <span className="font-bold text-emerald-300">{userProfile.paid_credits || 0}</span>
                        </div>

                        <div className="pt-4 mt-6 border-t border-slate-700">
                            <h3 className="text-sm font-semibold mb-3">Buy More Credits</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleBuyCredits(5)} className="bg-slate-700 hover:bg-slate-600 rounded py-2 text-sm font-medium transition">5 for ₹75</button>
                                <button onClick={() => handleBuyCredits(20)} className="bg-slate-700 hover:bg-slate-600 rounded py-2 text-sm font-medium transition">20 for ₹300</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-pulse bg-slate-800 h-24 rounded-lg"></div>
                )}
            </div>

            {/* Main Convert Area */}
            <div className="md:col-span-2 space-y-8">
                <div className="glass-panel p-8 rounded-2xl text-center border-blue-500/30 border-t-2">
                    <h2 className="text-2xl font-bold mb-6">Convert Video</h2>
                    <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 hover:border-blue-400 transition-colors bg-slate-800/50">
                        <input
                            type="file"
                            accept="video/mp4"
                            onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setFile(file);
                                setPriceEstimate(null);
                                if (file) {
                                    const url = URL.createObjectURL(file);
                                    const video = document.createElement('video');
                                    video.preload = 'metadata';
                                    video.onloadedmetadata = () => {
                                        window.URL.revokeObjectURL(url);
                                        calculatePriceLocal(video.duration);
                                    };
                                    video.src = url;
                                }
                            }}
                            className="hidden"
                            id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                            <svg className="w-12 h-12 text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-lg font-medium text-slate-200">{file ? file.name : "Select MP4 File"}</span>
                            <span className="text-sm text-slate-500 mt-2">Max 500MB</span>
                        </label>
                    </div>
                    {priceEstimate && (
                        <div className="mt-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-left text-sm max-w-sm mx-auto">
                            <h4 className="font-bold text-slate-300 border-b border-slate-700 pb-2 mb-2">Cost Estimation</h4>
                            <div className="flex justify-between py-1"><span>Tier:</span> <span className="font-medium text-blue-400">{priceEstimate.tier}</span></div>
                            <div className="flex justify-between py-1"><span>Billed Duration:</span> <span className="font-medium">{priceEstimate.roundedMinutes} min</span></div>
                            <div className="flex justify-between py-1"><span>Rate:</span> <span className="font-medium">₹{priceEstimate.pricePerMinute}/min</span></div>
                            <div className="flex justify-between py-1 border-t border-slate-700 mt-2 font-bold text-lg">
                                <span>Total Price:</span>
                                <span className={userProfile?.paid_credits >= priceEstimate.totalPrice || userProfile?.free_conversions_used < 3 ? 'text-emerald-400' : 'text-red-400'}>
                                    {userProfile?.free_conversions_used < 3 ? 'FREE (1 of 3)' : `₹${priceEstimate.totalPrice}`}
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleUploadAndConvert}
                        disabled={!file}
                        className="mt-6 w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 rounded-xl font-bold shadow-lg shadow-blue-500/20 text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Upload & Convert to HLS
                    </button>

                    {statusMsg && (
                        <div className="mt-6 p-4 bg-slate-800 rounded-lg text-sm text-blue-300 border border-slate-700">
                            {statusMsg}
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="w-full bg-slate-700 rounded-full h-2 mt-3 overflow-hidden">
                                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {jobStatus && (
                    <div className="glass-panel p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Job Status</h3>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${jobStatus.status === 'COMPLETE' ? 'bg-emerald-500/20 text-emerald-400' :
                                jobStatus.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                {jobStatus.status}
                            </span>
                        </div>
                        {jobStatus.outputUrl && (
                            <div className="bg-slate-800 p-4 rounded-lg mt-4 border border-slate-700">
                                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-2">HLS Streaming URL</span>
                                <input type="text" readOnly value={jobStatus.outputUrl} className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-white p-2" />
                                <a href={jobStatus.outputUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300 font-medium">Test Playback &rarr;</a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function Nav() {
    const [authed, setAuthed] = useState(false);
    const navigate = useNavigate();
    // Using a simplified auth check for Nav
    useEffect(() => {
        getCurrentUser().then(() => setAuthed(true)).catch(() => setAuthed(false));
    }, []);

    return (
        <nav className="border-b border-slate-800 sticky top-0 bg-brand-dark/90 backdrop-blur-md z-50">
            <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                <Link to="/" className="text-xl font-extrabold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white">▶</div>
                    ConvertSaaS
                </Link>
                <div className="flex gap-6 items-center font-medium">
                    <Link to="/pricing" className="text-slate-300 hover:text-white transition">Pricing</Link>
                    {authed ? (
                        <>
                            <Link to="/app" className="text-slate-300 hover:text-white transition">Dashboard</Link>
                            <button onClick={() => { signOut(); navigate('/'); window.location.reload(); }} className="text-sm border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-800 text-slate-300">Sign Out</button>
                        </>
                    ) : (
                        <Link to="/app" className="bg-white text-slate-900 px-6 py-2 rounded-lg hover:bg-slate-200 transition">Sign In</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}

function AdminDashboard() {
    return (
        <div className="max-w-6xl mx-auto py-10 px-4">
            <h2 className="text-3xl font-bold mb-8">Admin Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-blue-500">
                    <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Users</div>
                    <div className="text-3xl font-extrabold">1,248</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-emerald-500">
                    <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Conversions</div>
                    <div className="text-3xl font-extrabold">5,932</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-indigo-500">
                    <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Revenue (30d)</div>
                    <div className="text-3xl font-extrabold">₹48,290</div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-red-500">
                    <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">Failed Jobs</div>
                    <div className="text-3xl font-extrabold">12</div>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-700">
                <h3 className="text-xl font-bold mb-6">Recent User Activity & Abuse Log</h3>
                <p className="text-slate-400 italic mb-4">Mocked data: In production, wire this to DynamoDB Scanning.</p>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-700 text-slate-300">
                            <th className="py-3">User ID</th>
                            <th className="py-3">Plan</th>
                            <th className="py-3">Status</th>
                            <th className="py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-700/50">
                            <td className="py-4 font-mono">usr_98a1f...</td>
                            <td><span className="bg-emerald-500/20 text-emerald-400 px-2 flex-grow-0 py-0.5 rounded">Paid</span></td>
                            <td className="text-emerald-400">Active</td>
                            <td className="text-right text-red-400 hover:text-red-300 cursor-pointer font-medium">Suspend</td>
                        </tr>
                        <tr>
                            <td className="py-4 font-mono">usr_74bz...</td>
                            <td><span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded">Free</span></td>
                            <td className="text-red-400 cursor-help" title="WAF Rate Limit Exceeded">Blocked IPs (WAF)</td>
                            <td className="text-right text-red-500 hover:text-red-300 cursor-pointer font-medium">Ban</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-blue-500/30">
                <Nav />
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/admin" element={
                        <div className="amplify-auth-wrapper min-h-[80vh] flex items-center justify-center py-10">
                            <Authenticator>
                                {() => <AdminDashboard />}
                            </Authenticator>
                        </div>
                    } />
                    <Route path="/app" element={
                        <div className="amplify-auth-wrapper min-h-[80vh] flex items-center justify-center py-10">
                            <Authenticator>
                                {() => <Dashboard />}
                            </Authenticator>
                        </div>
                    } />
                </Routes>

                {/* Simple Footer */}
                <footer className="border-t border-slate-800 py-10 mt-20 text-center text-slate-500 text-sm">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center px-4 gap-4">
                        <div>© 2026 ConvertSaaS. All rights reserved.</div>
                        <div className="flex gap-6">
                            <a href="#" className="hover:text-slate-300">Terms of Service</a>
                            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
                            <a href="#" className="hover:text-slate-300">Contact Support</a>
                        </div>
                    </div>
                </footer>
            </div>
        </BrowserRouter>
    );
}

export default App;
