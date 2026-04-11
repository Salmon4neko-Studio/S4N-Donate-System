'use client';

import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface AlertSettings {
    imageUrl?: string;
    soundUrl?: string;
    fontFamily: string;
    duration: number;
    animationType: string;
    messageTemplate?: string;
    textColor?: string;
    amountColor?: string;
    fontSize?: number;
    messageFontSize?: number;
    animationDuration?: number;
    backgroundColor?: string;
    borderColor?: string;
    alertWidth?: number;
    alertHeight?: number;
    verticalAlign?: string;
    horizontalAlign?: string;
}

interface Donation {
    id: string;
    donorName: string;
    amount: number;
    message?: string;
}

// 定義自己的 CSS 屬性類型，避免依賴 React.CSSProperties
interface CSSProperties {
    [key: string]: string | number | undefined;
}

export default function OBSPage() {
    const [settings, setSettings] = useState<AlertSettings | null>(null);
    const [currentAlert, setCurrentAlert] = useState<Donation | null>(null);
    const [queue, setQueue] = useState<Donation[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // 確保頁面背景透明
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        
        // 添加全域樣式以確保透明背景
        const style = document.createElement('style');
        style.innerHTML = `
            html, body {
                background: transparent !important;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            #__next {
                background: transparent !important;
            }
        `;
        document.head.appendChild(style);

        // Fetch settings
        fetch('/api/settings')
            .then((res) => res.json())
            .then((data) => setSettings(data));

        // Initialize Socket.io
        socketInitializer();

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            document.head.removeChild(style);
        };
    }, []);

    const socketInitializer = async () => {
        await fetch('/api/socket/io');
        socketRef.current = io({
            path: '/api/socket/io',
            addTrailingSlash: false,
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to Socket.io');
        });

        socketRef.current.on('new-donation', (donation: Donation) => {
            console.log('New donation received:', donation);
            setQueue((prevQueue: Donation[]) => [...prevQueue, donation]);
        });
    };

    useEffect(() => {
        if (!currentAlert && queue.length > 0 && settings) {
            playAlert(queue[0]);
            setQueue((prevQueue: Donation[]) => prevQueue.slice(1));
        }
    }, [currentAlert, queue, settings]);

    const playAlert = (donation: Donation) => {
        setCurrentAlert(donation);
        // Small delay to ensure render before animation starts
        requestAnimationFrame(() => {
            setIsVisible(true);
        });

        if (settings?.soundUrl) {
            if (!audioRef.current) {
                audioRef.current = new Audio(settings.soundUrl);
            } else {
                audioRef.current.src = settings.soundUrl;
            }
            audioRef.current.play().catch((error: Error) => console.error('Audio play failed:', error));
        }

        setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
                setCurrentAlert(null);
            }, settings?.animationDuration || 1000); // Wait for exit animation
        }, settings?.duration || 5000);
    };

    if (!settings) return null;

    // Animation Styles Calculation - 修正版本
    const getAnimationStyles = (): CSSProperties => {
        const baseStyles = {
            transform: 'translate(0, 0) scale(1)',
            opacity: 1,
            transitionProperty: 'all',
            transitionDuration: `${settings.animationDuration || 1000}ms`,
            transitionTimingFunction: isVisible
                ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' // easeOutBack (Entry)
                : 'cubic-bezier(0.6, -0.28, 0.735, 0.045)', // easeInBack (Exit)
        };

        if (!isVisible) {
            switch (settings.animationType) {
                case 'slide-up':
                    return { ...baseStyles, opacity: 0, transform: 'translateY(2.5rem) scale(0.95)' };
                case 'slide-down':
                    return { ...baseStyles, opacity: 0, transform: 'translateY(-2.5rem) scale(0.95)' };
                case 'zoom':
                    return { ...baseStyles, opacity: 0, transform: 'scale(0)' };
                case 'bounce':
                    return { ...baseStyles, opacity: 0, transform: 'scale(0.5)' };
                case 'fade':
                default:
                    return { ...baseStyles, opacity: 0 };
            }
        }
        
        return baseStyles;
    };

    // Positioning styles - 修正版本
    const getContainerStyle = (): CSSProperties => {
        const style: CSSProperties = {
            display: 'flex',
            width: '100vw',
            height: '100vh',
            padding: '2rem',
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: 'transparent',
            minHeight: '100vh',
            position: 'absolute',
            top: 0,
            left: 0,
        };

        switch (settings.verticalAlign) {
            case 'start': style.alignItems = 'flex-start'; break;
            case 'end': style.alignItems = 'flex-end'; break;
            case 'center':
            default: style.alignItems = 'center'; break;
        }

        switch (settings.horizontalAlign) {
            case 'start': style.justifyContent = 'flex-start'; break;
            case 'end': style.justifyContent = 'flex-end'; break;
            case 'center':
            default: style.justifyContent = 'center'; break;
        }

        return style;
    };

    const renderMessage = () => {
        if (!currentAlert) return null;
        const template = settings.messageTemplate || '{name} 贊助了 ${amount}';
        // Replace {name} first
        const textWithName = template.replace('{name}', currentAlert.donorName);
        // Split by {amount} to isolate it
        const parts = textWithName.split('{amount}');

        return (
            <>
                {parts.map((part: string, i: number) => (
                    <span key={i}>
                        {part}
                        {i < parts.length - 1 && (
                            <span style={{ color: settings.amountColor || '#ff6b6b', fontWeight: 'bold' }}>
                                {currentAlert.amount}
                            </span>
                        )}
                    </span>
                ))}
            </>
        );
    };

    return (
        <div style={getContainerStyle()}>
            {currentAlert && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: '1rem',
                        fontFamily: settings.fontFamily,
                        width: settings.alertWidth ? `${settings.alertWidth}px` : '600px',
                        minHeight: settings.alertHeight ? `${settings.alertHeight}px` : 'auto',
                        maxWidth: '100%',
                        ...getAnimationStyles()
                    }}
                >
                    {settings.imageUrl && (
                        <img
                            src={settings.imageUrl}
                            alt="Alert Image"
                            style={{
                                maxWidth: '20rem',
                                maxHeight: '20rem',
                                objectFit: 'contain',
                                marginBottom: '1rem'
                            }}
                        />
                    )}

                    <div
                        style={{
                            padding: '1.5rem',
                            borderRadius: '0.75rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '4px solid',
                            position: 'relative',
                            overflow: 'hidden',
                            width: '100%',
                            backgroundColor: settings.backgroundColor || '#ffffff',
                            borderColor: settings.borderColor || '#000000'
                        }}
                    >
                        <h1
                            style={{
                                fontWeight: 900,
                                marginBottom: '0.5rem',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                                color: settings.textColor || '#1a1a1a',
                                fontSize: `${settings.fontSize || 32}px`,
                                lineHeight: '1.4',
                                margin: 0
                            }}
                        >
                            {renderMessage()}
                        </h1>
                        {currentAlert.message && (
                            <p
                                style={{
                                    fontSize: settings.messageFontSize ? `${settings.messageFontSize}px` : '24px',
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    maxWidth: '32rem',
                                    lineHeight: 1.625,
                                    margin: '0 auto',
                                    color: settings.textColor || '#1a1a1a',
                                    opacity: 0.9
                                }}
                            >
                                {currentAlert.message}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}