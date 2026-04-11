'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState('');
    const router = useRouter();

    // 檢查是否已登入
    useEffect(() => {
        // 簡單檢查是否有cookie (僅用於UI顯示，實際驗證在服務器端進行)
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include', // 重要：包含cookies
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        router.push('/dashboard');
                    }
                }
            } catch (err) {
                console.error('Auth check error:', err);
            }
        };
        
        checkAuth();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setDebugInfo('');

        try {
            console.log('Submitting login form...');
            
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include', // 重要：包含cookies
            });

            const data = await res.json();
            
            if (res.ok) {
                console.log('Login successful, redirecting...');
                setDebugInfo('登入成功，正在跳轉...');
                
                // 短暫延遲以確保cookie已設置
                setTimeout(() => {
                    router.push('/dashboard');
                }, 500);
            } else {
                console.error('Login failed:', data);
                setError(data.error || '登入失敗');
                if (data.details) {
                    setDebugInfo(`詳細錯誤: ${data.details}`);
                }
            }
        } catch (err) {
            console.error('Login request error:', err);
            setError('發生錯誤，請稍後再試');
            setDebugInfo(`錯誤詳情: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ts-center">
            <div className="ts-container is-narrow has-vertically-spaced-large">
                <div className="ts-header is-center-aligned is-heavy is-icon">
                    <span className="ts-icon is-user-icon"></span>
                    管理員登入
                </div>
                <div className="ts-text is-center-aligned is-secondary has-bottom-spaced-large">
                    請輸入管理員帳號密碼以進入後台
                </div>

                <form onSubmit={handleSubmit} className="ts-box is-segment is-elevated">
                    <div className="ts-content is-padded-large">
                        <div className="ts-grid is-stacked">
                            <div className="column">
                                <label className="ts-text is-label">帳號</label>
                                <div className="ts-input is-start-icon is-fluid">
                                    <span className="ts-icon is-user-icon"></span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Admin Username"
                                    />
                                </div>
                            </div>
                            <div className="column">
                                <label className="ts-text is-label">密碼</label>
                                <div className="ts-input is-start-icon is-fluid">
                                    <span className="ts-icon is-lock-icon"></span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="column">
                                    <div className="ts-notice is-negative">
                                        <div className="content">{error}</div>
                                    </div>
                                </div>
                            )}
                            {debugInfo && (
                                <div className="column">
                                    <div className="ts-notice is-info">
                                        <div className="content">{debugInfo}</div>
                                    </div>
                                </div>
                            )}
                            <div className="column">
                                <button
                                    className={`ts-button is-fluid is-primary ${loading ? 'is-loading' : ''}`}
                                    type="submit"
                                >
                                    登入
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}