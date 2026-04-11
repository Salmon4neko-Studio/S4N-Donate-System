'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TestAuthPage() {
    const [authStatus, setAuthStatus] = useState<{
        authenticated: boolean;
        user?: { username: string };
        error?: string;
        details?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [cookies, setCookies] = useState<string>('');

    useEffect(() => {
        // 檢查認證狀態
        const checkAuth = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/auth/check', {
                    method: 'GET',
                    credentials: 'include',
                });
                
                const data = await res.json();
                setAuthStatus(data);
                
                // 嘗試讀取 document.cookie 來檢查 cookie
                setCookies(document.cookie || '無法讀取 cookie');
            } catch (err) {
                setAuthStatus({
                    authenticated: false,
                    error: 'Error checking authentication',
                    details: err instanceof Error ? err.message : String(err)
                });
            } finally {
                setLoading(false);
            }
        };
        
        checkAuth();
    }, []);

    const handleForceRedirect = (path: string) => {
        window.location.href = path;
    };

    return (
        <div className="ts-container is-narrow has-vertically-spaced-large">
            <div className="ts-header is-large is-heavy has-top-spaced-large">認證測試頁面</div>
            
            <div className="ts-box">
                <div className="ts-content is-padded-large">
                    <div className="ts-header is-heavy is-small">認證狀態</div>
                    {loading ? (
                        <div className="ts-loading is-centered"></div>
                    ) : (
                        <div className="ts-text">
                            <p>
                                <strong>已登入:</strong> {authStatus?.authenticated ? '是' : '否'}
                            </p>
                            {authStatus?.authenticated && authStatus.user && (
                                <p>
                                    <strong>使用者:</strong> {authStatus.user.username}
                                </p>
                            )}
                            {authStatus?.error && (
                                <div className="ts-notice is-negative">
                                    <div className="title">{authStatus.error}</div>
                                    {authStatus.details && <div className="content">{authStatus.details}</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="ts-divider"></div>
                <div className="ts-content is-padded-large">
                    <div className="ts-header is-heavy is-small">Cookie 資訊</div>
                    <div className="ts-text">
                        <pre style={{ 
                            background: '#f5f5f5', 
                            padding: '1rem', 
                            borderRadius: '0.3rem',
                            overflow: 'auto',
                            maxHeight: '200px'
                        }}>
                            {cookies || '無法讀取 cookie'}
                        </pre>
                    </div>
                </div>
                <div className="ts-divider"></div>
                <div className="ts-content is-padded-large">
                    <div className="ts-header is-heavy is-small">測試操作</div>
                    <div className="ts-grid is-3-columns has-top-spaced">
                        <div className="column">
                            <button 
                                className="ts-button is-fluid" 
                                onClick={() => handleForceRedirect('/login')}
                            >
                                前往登入頁
                            </button>
                        </div>
                        <div className="column">
                            <button 
                                className="ts-button is-fluid is-primary" 
                                onClick={() => handleForceRedirect('/dashboard')}
                            >
                                強制前往儀表板
                            </button>
                        </div>
                        <div className="column">
                            <button 
                                className="ts-button is-fluid is-negative" 
                                onClick={() => {
                                    // 清除 cookie
                                    document.cookie = 'auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                                    // 重新載入頁面
                                    window.location.reload();
                                }}
                            >
                                清除 Cookie
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="ts-text is-center-aligned has-top-spaced-large">
                <Link href="/" className="ts-link">返回首頁</Link>
            </div>
        </div>
    );
}