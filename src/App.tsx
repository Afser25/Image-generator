

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateInpaintedImage, generateCharacterImage } from './services/geminiService';
import { auth, db } from './firebase';
import firebase from 'firebase/compat/app';


// --- Helper Functions ---
const getEventCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in event) { // Touch event
        if (event.touches.length === 0) return null;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else { // Mouse event
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
};

const addWatermark = (base64Image: string): Promise<string> => {
    // This is the logo provided by the user, encoded as a base64 data URL.
    const logoSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAARJSURBVHhe7Zx/aFtlGMf/p7sJm7a5tda+ldY+6FhrKxsqoYJ0uYJ1hI1UHIoVB8Uu4iiig4PgokPEQS6CUvRcdNFNHDvQgf9RcJCCoMOhUwgqg5aWstYWNbVNn216k5f3vSclLanLdJP0B7/k5P3e5/t+n+/3Jb/nBShQoECBAgW+qUCu13sTQlCj0bg7m81+Fx5n8LqEIE8QBLvd7gNCyE8IgcPh+JzzC42o1qsqnU5nS0tLLu2v4vDL6XReEAR5O1eBQgEtLS3nOI4Pw2FQRVGKMAy7SqXS6+vrsdbrXUIIXldV/RJCnKWUa5qmEUL4Uo0aUARBeDweh1EUZTabzWaz2Ww2K5XK0uv1DkIIM5vNgiBc1HW9uVLq2u/3T7U6FagIguPxuGEYdgghhGEYx3HUtm1d1yGEsFar1el0GgRBOI5jVVWlUqm3221FUfQkSb4ppT5WqzVrNpsTjUY/b3ca+BshxGq16nQ67Q/39/fH/X7/k2EYURQli8XiCR6PB0IInU6nXC43m80uLS2tVqv9F0KYpZRBEGSA5/kQpxoVqBBCarUaTdPW63VBEGytra2tra2trc3NzU1NTU1NTY2NjY2MjLS0tBQKhfR6vVwuZ7fbk0TJZDJBEARBgBBCURSXy6XVav1qjRoQBEGv11MIoaurq7e3t7e3t7e3t7W1NTIy0tLS0tDQ0MTEhMViSZIkSZKkUqkWiwWEUFXVpmmbpulIJBJkWRYEQavVWv/vGvifEMJut3sYhsNhGEKI4zgSiQQhhCAIsizTNJ1Op7e2tvb29ubm5ubm5hMTEyMjI/F4XFVVbW1tVVVVVqs1SZIURcnkctM0rVarPM/3+/0P1qgBIVJKDYIgSZKmaQghOI5LpVJLS0tDQ0MTE5OpqalpaWkpFAqr1aooirZt7/V6OI5FUZROp1MIwXVdURRBEARBkGXZbre/U6MGEGXZbre7WCweDocURck0zTAMQwjRdV3XdSGEbre7u7s7Pz8/Pz9/cnLybDb7+vo6SRJBEHie53mepmlFUUwul2maJkkihLBarX/TqAFBECGEIAhBEJIkYRiWy+X29vbGxsbGxsampqYmJiYmJibm5uampqaGhoYWFhaWlpaEEFmWKYqyz+fzfD7vdDqCIAihVJqm3W7/+xrg34IgXCqV3m63f3Nzc319fXt7e3d3d3d3d3Z2dnp6enZ2dnJycmxsbHx8fHx8fHt7e2trK03Tvu/7vj/P88/zHMdxHMeWZdlqtcrl8kwm43Q6/aNGhAE4XA4HA4HiKJ4cnLy7OzszMzMzMzMzs7OycnJyMjIyMjAwODg6Njc3Nza2tra2trU1dXV1dXV1vb28Yhvn5+Xl5ebm4uDgyMjIyMhKHw/E8L4qijONIIYTdbvefNWpAlmXbdhAEURTFYDCYmZlZWVlZWVl5eno6Nze3ubm5t7fX6XQGg0EoFDp+/PhLwzRKKQzDoFarv/8a4G+SJLe2tq5Wq1deWVsbHx8fHxycmJubn5xcXF8fGxrZarcrlciQSnZycHD9+/Jjj+P39/fn5+UQiUSqVLhQKYRiWUmVZ5mmapmlKpVL/rFEBCoIgCIIURUnTNHme53l+cnJydHR0fHx8fn5+dnb25ORkfn7+2NjY+Ph4eno6m83WajWKonS73ZmZmUwmk06nJ0mSy+V+uUZ9oECBAgUKFPhfCpxO52tra2tra6tSqRweHh4aGgoEAmfOnJk9e/alS5fOnz//0KFDc3Nz8/PzDwwMTE1NzMzMjI2Nra2t/Qe9D30DqgW+rAAAAABJRU5kJggg==';
    
    return new Promise((resolve, reject) => {
        const mainImage = new Image();
        const logoImage = new Image();

        let mainImageLoaded = false;
        let logoImageLoaded = false;
        
        const attemptDrawing = () => {
            if (!mainImageLoaded || !logoImageLoaded) return;
            
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error("Could not get canvas context for watermarking"));
                }
                
                canvas.width = mainImage.width;
                canvas.height = mainImage.height;
                ctx.drawImage(mainImage, 0, 0);

                // --- Watermark Styles ---
                const padding = Math.max(20, canvas.width * 0.015);
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                
                // --- Text properties ---
                const nameFontSize = Math.max(14, Math.min(canvas.width * 0.025, 36));
                const toolFontSize = Math.max(10, Math.min(canvas.width * 0.015, 22));
                const lineSpacing = 8;
                const line1 = "Opu chowdhury";
                const line2 = "image generate by AI image editor";

                const textBlockHeight = nameFontSize + toolFontSize + lineSpacing;
                
                // Temporarily set font to measure text width accurately
                ctx.font = `italic bold ${nameFontSize}px 'Georgia', serif`;
                const text1Metrics = ctx.measureText(line1);
                ctx.font = `${toolFontSize}px 'Arial', sans-serif`;
                const text2Metrics = ctx.measureText(line2);
                const textBlockWidth = Math.max(text1Metrics.width, text2Metrics.width);

                // --- Logo properties ---
                const logoHeight = textBlockHeight * 1.2; // Make logo slightly taller than text
                const logoAspectRatio = logoImage.width / logoImage.height;
                const logoWidth = logoHeight * logoAspectRatio;
                const logoPadding = 15;
                
                // --- Draw Logo ---
                const logoX = canvas.width - padding - textBlockWidth - logoPadding - logoWidth;
                const logoY = canvas.height - padding - logoHeight;
                ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);

                // --- Draw Text (with shadow) ---
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                const textX = canvas.width - padding;
                const textY = canvas.height - padding;
                
                ctx.font = `${toolFontSize}px 'Arial', sans-serif`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.fillText(line2, textX, textY - nameFontSize - lineSpacing);

                ctx.font = `italic bold ${nameFontSize}px 'Georgia', serif`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillText(line1, textX, textY);
                
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                reject(e);
            }
        };

        const onError = (type: string) => () => {
            reject(new Error(`Failed to load ${type} for watermarking.`));
        };

        mainImage.onload = () => { mainImageLoaded = true; attemptDrawing(); };
        logoImage.onload = () => { logoImageLoaded = true; attemptDrawing(); };

        mainImage.onerror = onError('image');
        logoImage.onerror = onError('logo');

        mainImage.src = base64Image;
        logoImage.src = logoSrc;
    });
};


// --- Icon Components ---
const UploadIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> );
const BrushIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg> );
const ClearIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> );
const SparklesIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6.343 6.343l-2.828 2.829M17.657 17.657l2.828 2.829M18 5h4M19 3v4M12 3v4M3 19h4M5 21v-4M12 21v-4m5.657-12.343l-2.828-2.829M6.343 17.657l-2.828-2.829" /></svg> );
const UpgradeIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> );
const LogoutIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>);
const AdminIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-4 0h4" /></svg>);
const CreditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /><path d="M12 18a6 6 0 100-12 6 6 0 000 12z" /></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-3-5.197M15 21a9 9 0 00-9-9" /></svg>);
const BackIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>);

const IMAGE_GENERATION_COST = 5;

type UserData = {
    credits: number;
    isAdmin?: boolean;
    email: string;
};

type AllUsers = {
    [uid: string]: UserData;
};

type EditorMode = 'inpainting' | 'photoshoot';


export default function App() {
    // Editor State
    const [editorMode, setEditorMode] = useState<EditorMode>('inpainting');
    const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
    const [originalImageType, setOriginalImageType] = useState<string>('image/png');
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [brushSize, setBrushSize] = useState<number>(40);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef<boolean>(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const usersListenerUnsubscribe = useRef<(() => void) | null>(null);
    const userListenerUnsubscribe = useRef<(() => void) | null>(null);

    // Auth & User State
    const [user, setUser] = useState<firebase.User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    
    // Admin State
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [allUsers, setAllUsers] = useState<AllUsers | null>(null);
    const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});


    // --- Auth Effect ---
    useEffect(() => {
        const authUnsubscribe = auth.onAuthStateChanged((currentUser) => {
            // Clean up previous user listener if it exists
            if (userListenerUnsubscribe.current) {
                userListenerUnsubscribe.current();
                userListenerUnsubscribe.current = null;
            }
    
            setUser(currentUser);
            if (currentUser) {
                const userRef = db.ref('users/' + currentUser.uid);
                const onValueChange = (snapshot: firebase.database.DataSnapshot) => {
                    const data = snapshot.val();
                    if (data) setUserData(data);
                    setIsAuthLoading(false);
                };
                userRef.on('value', onValueChange);
                userListenerUnsubscribe.current = () => userRef.off('value', onValueChange);
            } else {
                setUserData(null);
                setIsAuthLoading(false);
            }
        });
    
        return () => {
            authUnsubscribe();
            // Clean up user listener on component unmount
            if (userListenerUnsubscribe.current) {
                userListenerUnsubscribe.current();
            }
        };
    }, []);

    // --- Loading Message Effect ---
    useEffect(() => {
        let intervalId: number;
        if (isLoading) {
            const messages = [
                "Analyzing facial geometry...",
                "Mapping unique features...",
                "Understanding scene requirements...",
                "Crafting the new composition...",
                "Applying hyper-realistic lighting...",
                "This detailed process can take a moment..."
            ];
            let messageIndex = 0;
            setLoadingMessage(messages[messageIndex]);
    
            intervalId = window.setInterval(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                setLoadingMessage(messages[messageIndex]);
            }, 3000);
        }
    
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isLoading]);

    // --- Image & Canvas Logic ---
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
                setError('Please upload a JPEG or PNG image.');
                return;
            }
            setError(null);
            setResultImage(null);
            setOriginalImageType(file.type);
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => setOriginalImage(img);
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (originalImage && imageCanvasRef.current) {
            const imageCanvas = imageCanvasRef.current;
            const imageCtx = imageCanvas.getContext('2d');
            if (!imageCtx) return;

            // Use the image's true dimensions for the best quality
            const canvasWidth = originalImage.naturalWidth;
            const canvasHeight = originalImage.naturalHeight;

            imageCanvas.width = canvasWidth;
            imageCanvas.height = canvasHeight;
            
            imageCtx.clearRect(0, 0, canvasWidth, canvasHeight);
            imageCtx.drawImage(originalImage, 0, 0, canvasWidth, canvasHeight);

            // Also initialize the mask canvas if it's rendered
            const maskCanvas = maskCanvasRef.current;
            if (maskCanvas) {
                const maskCtx = maskCanvas.getContext('2d');
                if (maskCtx) {
                    maskCanvas.width = canvasWidth;
                    maskCanvas.height = canvasHeight;
                    maskCtx.clearRect(0, 0, canvasWidth, canvasHeight);
                }
            }
        }
    }, [originalImage, editorMode]);

    const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        if (!canvas || !originalImage) return;
        if ('touches' in e) e.preventDefault();
        isDrawing.current = true;
        lastPos.current = getEventCoordinates(e, canvas);
    }, [originalImage]);

    const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || !maskCanvasRef.current) return;
        if ('touches' in e) e.preventDefault();
        
        const canvas = maskCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const currentPos = getEventCoordinates(e, canvas);
        if (ctx && lastPos.current && currentPos) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(currentPos.x, currentPos.y);
            ctx.stroke();
            lastPos.current = currentPos;
        }
    }, [brushSize]);


    const stopDrawing = useCallback(() => {
        isDrawing.current = false;
        lastPos.current = null;
    }, []);

    const clearMask = () => {
        const canvas = maskCanvasRef.current;
        if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleGenerate = async () => {
        if (!originalImage || !prompt.trim()) {
            setError('Please upload an image and provide a prompt.');
            return;
        }
        if (!user || !userData) {
            setError('You must be logged in to generate images.');
            return;
        }
        if (userData.credits < IMAGE_GENERATION_COST) {
            alert('You do not have enough credits. Please upgrade your plan.');
            window.open('https://m.me/afserhossenopuchowdhury?hash=AbbDCKp3ZrCytWlh&source=qr_link_share', '_blank');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultImage(null);
        
        try {
            let result;
            if (editorMode === 'photoshoot') {
                const base64Image = originalImage.src;
                result = await generateCharacterImage(base64Image, originalImageType, prompt);
            } else { // Inpainting mode
                const compositeCanvas = document.createElement('canvas');
                const compositeCtx = compositeCanvas.getContext('2d');
                const maskCanvas = maskCanvasRef.current;
                if (!compositeCtx || !maskCanvas) throw new Error("Could not create canvas context.");

                compositeCanvas.width = originalImage.naturalWidth;
                compositeCanvas.height = originalImage.naturalHeight;
                compositeCtx.drawImage(originalImage, 0, 0);

                const tempMaskCanvas = document.createElement('canvas');
                const tempMaskCtx = tempMaskCanvas.getContext('2d');
                if (!tempMaskCtx) throw new Error("Could not create temp mask context.");
                
                tempMaskCanvas.width = maskCanvas.width;
                tempMaskCanvas.height = maskCanvas.height;
                tempMaskCtx.drawImage(maskCanvas, 0, 0);
                tempMaskCtx.globalCompositeOperation = 'source-in';
                tempMaskCtx.fillStyle = 'white';
                tempMaskCtx.fillRect(0, 0, tempMaskCanvas.width, tempMaskCanvas.height);
                compositeCtx.drawImage(tempMaskCanvas, 0, 0, originalImage.naturalWidth, originalImage.naturalHeight);

                const base64Image = compositeCanvas.toDataURL(originalImageType, 0.95);
                result = await generateInpaintedImage(base64Image, originalImageType, prompt);
            }
            
            const watermarkedResult = await addWatermark(result);
            setResultImage(watermarkedResult);

            const newCredits = userData.credits - IMAGE_GENERATION_COST;
            await db.ref('users/' + user.uid).update({ credits: newCredits });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const downloadImage = () => {
        if (resultImage) {
            const link = document.createElement('a');
            link.href = resultImage;
            link.download = 'generated-by-ai-editor.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // --- Auth Handlers ---
    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        if (authView === 'signup') {
             try {
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                await db.ref('users/' + cred.user.uid).set({
                    email: cred.user.email,
                    credits: 10,
                    isAdmin: false,
                });
            } catch (error: any) { setAuthError(error.message); }
        } else { // Login
            if (email === 'admin.opu@gmail.com' && password === 'opu@2525') {
                 try {
                    const cred = await auth.signInWithEmailAndPassword(email, password);
                    await db.ref('users/' + cred.user.uid).update({ isAdmin: true });
                } catch (signInError: any) {
                    if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found') {
                        try {
                            const adminCred = await auth.createUserWithEmailAndPassword(email, password);
                            await db.ref('users/' + adminCred.user.uid).set({
                                email: adminCred.user.email,
                                credits: 99999,
                                isAdmin: true,
                            });
                        } catch (signUpError: any) {
                             setAuthError(signUpError.code === 'auth/email-already-in-use' ? 'Admin account exists, but the password provided is incorrect.' : signUpError.message);
                        }
                    } else { setAuthError(signInError.message); }
                }
            } else { // Regular user login
                try {
                    await auth.signInWithEmailAndPassword(email, password);
                } catch (error: any) { setAuthError(error.message); }
            }
        }
    };

    const handleLogout = () => auth.signOut();
    
    // --- Admin Handlers ---
    const toggleAdminPanel = () => {
        if (showAdminPanel) {
            if (usersListenerUnsubscribe.current) {
                usersListenerUnsubscribe.current();
                usersListenerUnsubscribe.current = null;
            }
            setShowAdminPanel(false);
        } else {
            const usersRef = db.ref('users/');
            const onValueChange = (snapshot: firebase.database.DataSnapshot) => {
                setAllUsers(snapshot.val());
            };
            usersRef.on('value', onValueChange);
            usersListenerUnsubscribe.current = () => usersRef.off('value', onValueChange);
            setShowAdminPanel(true);
        }
    };

    const handleAddCredits = async (userId: string, currentCredits: number) => {
        const amountToAdd = Number(creditInputs[userId] || 0);
        if (!amountToAdd || isNaN(amountToAdd)) return;

        try {
            await db.ref('users/' + userId).update({
                credits: currentCredits + amountToAdd
            });
            setCreditInputs(prev => ({ ...prev, [userId]: '' }));
        } catch (err) {
            console.error("Failed to add credits:", err);
            alert("Failed to update credits.");
        }
    };

    const handleToggleAdmin = async (userId: string, isAdmin: boolean) => {
        try {
            await db.ref('users/' + userId).update({
                isAdmin: !isAdmin
            });
        } catch (err) {
            console.error("Failed to toggle admin status:", err);
            alert("Failed to update admin status.");
        }
    };
    
    const adminUsersArray = allUsers ? Object.entries(allUsers).filter(([, data]) => data && typeof data === 'object').map(([uid, data]) => ({ uid, ...(data as UserData) })) : [];
    const totalCreditsInSystem = adminUsersArray.reduce((sum, user) => sum + (user.credits || 0), 0);

    // --- Render Logic ---
    if (isAuthLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="w-16 h-16 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col items-center justify-center p-4 selection:bg-purple-500/30">
                <div className="w-full max-w-md">
                     <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 text-center mb-2">
                        AI Image Editor
                    </h1>
                     <p className="text-gray-400 mt-2 mb-8 text-center">
                        {authView === 'login' ? 'Welcome back! Log in to continue.' : 'Create an account to begin.'}
                    </p>
                    <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl shadow-purple-900/10 border border-gray-700">
                        <form onSubmit={handleAuthAction}>
                            <div className="space-y-4">
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" />
                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" />
                            </div>
                            {authError && <p className="text-red-400 text-sm mt-4 text-center">{authError}</p>}
                            <button type="submit" className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02]">
                                {authView === 'login' ? 'Log In' : 'Sign Up'}
                            </button>
                        </form>
                        <p className="text-center text-gray-400 text-sm mt-4">
                            {authView === 'login' ? "Don't have an account?" : "Already have an account?"}
                            <button onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')} className="font-semibold text-purple-400 hover:text-purple-300 ml-1">
                                {authView === 'login' ? 'Sign up' : 'Log in'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (showAdminPanel && userData?.isAdmin) {
         return (
            <div className="min-h-screen bg-gray-950 text-gray-200 p-4 sm:p-8 selection:bg-purple-500/30">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Admin Dashboard</h1>
                    <button onClick={toggleAdminPanel} className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        <BackIcon /> Back to Editor
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 flex items-center gap-4">
                        <UsersIcon />
                        <div>
                            <p className="text-gray-400 text-sm">Total Users</p>
                            <p className="text-3xl font-bold">{adminUsersArray.length}</p>
                        </div>
                    </div>
                     <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 flex items-center gap-4">
                        <CreditIcon />
                        <div>
                            <p className="text-gray-400 text-sm">Total Credits in System</p>
                            <p className="text-3xl font-bold">{totalCreditsInSystem.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800/60">
                            <tr>
                                <th className="p-4 font-semibold">Email</th>
                                <th className="p-4 font-semibold">Credits</th>
                                <th className="p-4 font-semibold">Role</th>
                                <th className="p-4 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminUsersArray.map(({ uid, email, credits, isAdmin }) => (
                                <tr key={uid} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-800/40 transition-colors">
                                    <td className="p-4">{email}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span>{credits}</span>
                                            <input 
                                                type="number" 
                                                value={creditInputs[uid] || ''}
                                                onChange={(e) => setCreditInputs(prev => ({ ...prev, [uid]: e.target.value }))}
                                                placeholder="Add"
                                                className="w-20 bg-gray-700 border border-gray-600 rounded p-1 text-sm"
                                            />
                                            <button onClick={() => handleAddCredits(uid, credits)} className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs font-bold">ADD</button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isAdmin ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-600/30 text-gray-300'}`}>
                                            {isAdmin ? 'Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={() => handleToggleAdmin(uid, !!isAdmin)} className={`px-3 py-1 rounded text-xs font-bold ${isAdmin ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-sky-600 hover:bg-sky-700'}`}>
                                            {isAdmin ? 'Remove Admin' : 'Make Admin'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         );
    }
    
    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col p-4 sm:p-6 lg:p-8 selection:bg-purple-500/30">
            <header className="flex flex-wrap justify-between items-center mb-6 sm:mb-8 gap-4">
                 <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    AI Image Editor
                </h1>
                 <div className="flex items-center gap-2 sm:gap-4 bg-gray-900/50 border border-gray-700 p-2 rounded-full shadow-lg">
                    <div className="flex items-center gap-2 px-3">
                        <CreditIcon />
                        <span className="font-bold text-lg text-amber-400">{userData?.credits ?? 0}</span>
                        <span className="text-gray-400 text-sm hidden sm:inline">Credits</span>
                    </div>
                    <button onClick={() => window.open('https://m.me/afserhossenopuchowdhury?hash=AbbDCKp3ZrCytWlh&source=qr_link_share', '_blank')} className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full text-sm transition-transform hover:scale-105">
                        <UpgradeIcon /> <span className="hidden sm:inline ml-1">Upgrade</span>
                    </button>
                    {userData?.isAdmin && <button onClick={toggleAdminPanel} className="flex items-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-3 rounded-full text-sm transition-transform hover:scale-105"><AdminIcon /> <span className="hidden sm:inline ml-1">Admin</span></button>}
                    <button onClick={handleLogout} className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-full text-sm transition-transform hover:scale-105">
                        <LogoutIcon />
                    </button>
                </div>
            </header>

            <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel: Editor */}
                <div className="grid grid-rows-[auto_1fr_auto] gap-4 bg-gray-900/50 p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-gray-700">
                    
                    {/* Row 1: Mode Toggle */}
                    <div className="flex items-center justify-center p-1 bg-gray-800/50 rounded-lg">
                        <button onClick={() => setEditorMode('inpainting')} className={`w-1/2 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${editorMode === 'inpainting' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                            Inpainting Editor
                        </button>
                        <button onClick={() => setEditorMode('photoshoot')} className={`w-1/2 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${editorMode === 'photoshoot' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                            AI Photoshoot
                        </button>
                    </div>

                    {/* Row 2: Canvas Area */}
                    <div className="relative w-full min-h-0 bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 overflow-hidden p-2">
                        {originalImage ? (
                             <div className="relative w-auto h-auto max-w-full max-h-full" style={{ aspectRatio: `${originalImage.naturalWidth} / ${originalImage.naturalHeight}` }}>
                                <canvas ref={imageCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                                {editorMode === 'inpainting' && (
                                    <canvas
                                        ref={maskCanvasRef}
                                        className="absolute top-0 left-0 w-full h-full cursor-crosshair z-10"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        onTouchCancel={stopDrawing}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-400 p-4">
                                <UploadIcon />
                                <p>{editorMode === 'inpainting' ? 'Upload image to edit' : 'Upload a reference photo'}</p>
                                <p className="text-xs text-gray-500 mt-1">PNG or JPEG supported</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Row 3: Controls */}
                    <div className="flex flex-col gap-4">
                        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-transform hover:scale-[1.02]">
                            <UploadIcon /> {originalImage ? 'Change Image' : 'Upload Image'}
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/png, image/jpeg" className="hidden" />

                        <div className={`transition-opacity duration-500 ${originalImage ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div className="flex flex-col gap-4">
                                <div className="bg-gray-800/50 p-4 rounded-lg">
                                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Describe what to generate:</label>
                                    <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} 
                                        placeholder={editorMode === 'inpainting' ? "e.g., A futuristic robot holding a flower" : "e.g., as an astronaut on Mars"}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none transition" rows={3} />
                                </div>
                                
                                {editorMode === 'inpainting' && (
                                    <div className="bg-gray-800/50 p-4 rounded-lg">
                                        <label htmlFor="brushSize" className="flex items-center text-sm font-medium text-gray-300 mb-2"><BrushIcon /> Brush Size: {brushSize}px</label>
                                        <div className="flex items-center gap-4">
                                            <input id="brushSize" type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                            <div className="bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0" style={{ width: '50px', height: '50px' }}>
                                                <div className="bg-red-500/70 rounded-full transition-all" style={{ width: `${(brushSize/100) * 40 + 5}px`, height: `${(brushSize/100) * 40 + 5}px` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {editorMode === 'inpainting' ? (
                                        <button onClick={clearMask} disabled={isLoading} className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ClearIcon /> Clear Mask</button>
                                    ) : <div className="hidden sm:block"></div>}
                                    <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] sm:col-start-2"><SparklesIcon /> {isLoading ? 'Generating...' : 'Generate'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Result */}
                <div className="flex flex-col gap-4 bg-gray-900/50 p-6 rounded-2xl shadow-2xl shadow-purple-900/10 border border-gray-700">
                    <h2 className="text-2xl font-bold text-center text-gray-300">Result</h2>
                    <div className="flex-grow bg-gray-800/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 overflow-hidden relative p-4">
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-400 text-center">
                                <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-600 rounded-full animate-spin"></div>
                                <p className="mt-4 font-semibold">{loadingMessage}</p>
                            </div>
                        )}
                        {error && <div className="text-red-400 p-4 text-center bg-red-900/20 rounded-lg border border-red-500/50"><strong>Error:</strong> {error}</div>}
                        {!isLoading && !error && resultImage && ( <img src={resultImage} alt="Generated result" className="max-w-full max-h-full object-contain" /> )}
                        {!isLoading && !error && !resultImage && (
                            <div className="text-center text-gray-500 p-4"><SparklesIcon /><p>Your generated image will appear here.</p></div>
                        )}
                    </div>
                    {resultImage && !isLoading && (
                         <button onClick={downloadImage} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-transform hover:scale-[1.02]">Download Image</button>
                    )}
                </div>
            </main>
        </div>
    );
}