"use client";

import * as React from "react";
import { useTheme } from "next-themes";

/* ─────────────────────────────────────────────────────────────
   ThemeToggle – Premium Day/Night Switch
   ─────────────────────────────────────────────────────────────
   • Pill-shaped track with day-sky / night-sky gradient
   • Oversized floating thumb with soft shadow
   • SVG morphing icon (sun ↔ moon) inside thumb
   • Stars fade-in during night transition
   • Subtle "sunrise/sunset" gradient midway
   • Scale pulse on toggle for tactile feedback
   ───────────────────────────────────────────────────────────── */

export function ThemeToggle() {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    const [isPulsing, setIsPulsing] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div
                className="shrink-0"
                style={{
                    width: 62,
                    height: 32,
                    borderRadius: 9999,
                    background: 'linear-gradient(135deg, #cbd5e1, #e2e8f0)',
                }}
            />
        );
    }

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';

    const handleToggle = () => {
        setIsPulsing(true);
        setTheme(isDark ? 'light' : 'dark');
        setTimeout(() => setIsPulsing(false), 400);
    };

    return (
        <button
            type="button"
            onClick={handleToggle}
            className="shrink-0 outline-none"
            aria-label="Alternar modo oscuro"
            title="Alternar Tema"
            style={{
                /* Larger hit area than visual element */
                padding: 4,
                margin: -4,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                background: 'transparent',
                border: 'none',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: 62,
                    height: 32,
                    borderRadius: 9999,
                    overflow: 'hidden',
                    transition: 'box-shadow 0.4s ease',
                    boxShadow: isDark
                        ? 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(99,102,241,0.15)'
                        : 'inset 0 1px 3px rgba(0,0,0,0.12), 0 0 8px rgba(56,189,248,0.12)',
                }}
            >
                {/* ── Track Background: Day/Night Sky ── */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        transition: 'opacity 0.5s ease-in-out',
                        background: 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 40%, #E0F4FF 100%)',
                        opacity: isDark ? 0 : 1,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        transition: 'opacity 0.5s ease-in-out',
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1a1f3a 100%)',
                        opacity: isDark ? 1 : 0,
                    }}
                />

                {/* ── Sunset/Sunrise Gradient Overlay ── */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, transparent 30%, rgba(251,146,60,0.18) 70%, rgba(251,113,133,0.12) 100%)',
                        opacity: isPulsing ? 0.9 : 0,
                        transition: 'opacity 0.4s ease-in-out',
                        pointerEvents: 'none',
                    }}
                />

                {/* ── Stars (Night Sky) ── */}
                <svg
                    viewBox="0 0 62 32"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        opacity: isDark ? 1 : 0,
                        transition: 'opacity 0.6s ease-in-out 0.15s',
                        pointerEvents: 'none',
                    }}
                >
                    {/* Static stars */}
                    <circle cx="8" cy="8" r="0.8" fill="white" opacity="0.9" />
                    <circle cx="14" cy="18" r="0.5" fill="white" opacity="0.6" />
                    <circle cx="20" cy="6" r="0.6" fill="white" opacity="0.7" />
                    <circle cx="12" cy="26" r="0.5" fill="white" opacity="0.5" />
                    <circle cx="25" cy="14" r="0.4" fill="white" opacity="0.55" />
                    <circle cx="6" cy="20" r="0.4" fill="white" opacity="0.45" />
                    {/* Twinkling stars */}
                    <circle cx="18" cy="10" r="0.7" fill="white" opacity="0.8">
                        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="10" cy="14" r="0.45" fill="white" opacity="0.6">
                        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3.2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="22" cy="24" r="0.55" fill="white" opacity="0.7">
                        <animate attributeName="opacity" values="0.7;0.25;0.7" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="5" cy="12" r="0.35" fill="white" opacity="0.5">
                        <animate attributeName="opacity" values="0.5;0.15;0.5" dur="3.8s" repeatCount="indefinite" />
                    </circle>
                </svg>

                {/* ── Light clouds hint (Day) ── */}
                <svg
                    viewBox="0 0 62 32"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        opacity: isDark ? 0 : 0.25,
                        transition: 'opacity 0.5s ease-in-out',
                        pointerEvents: 'none',
                    }}
                >
                    <ellipse cx="14" cy="22" rx="8" ry="3.5" fill="white" opacity="0.6" />
                    <ellipse cx="10" cy="21" rx="5" ry="3" fill="white" opacity="0.4" />
                    <ellipse cx="20" cy="23" rx="4" ry="2.5" fill="white" opacity="0.35" />
                </svg>

                {/* ── Thumb ── */}
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: 6,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        transform: `translate3d(${isDark ? '28px' : '0px'}, -50%, 0) scale(${isPulsing ? 1.12 : 1})`,
                        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease, box-shadow 0.4s ease',
                        background: isDark
                            ? 'linear-gradient(145deg, #334155, #1e293b)'
                            : 'linear-gradient(145deg, #ffffff, #f1f5f9)',
                        boxShadow: isDark
                            ? '0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)'
                            : '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(148,163,184,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                    }}
                >
                    {/* ── SVG Morphing Icon ── */}
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                            width: 16,
                            height: 16,
                            transition: 'transform 0.35s ease-in-out',
                            transform: isDark ? 'rotate(-30deg)' : 'rotate(0deg)',
                        }}
                    >
                        {/* Moon crescent mask – applied over the circle for moon shape */}
                        <defs>
                            <mask id="moonMask">
                                <rect x="0" y="0" width="24" height="24" fill="white" />
                                <circle
                                    cx={isDark ? 16 : 28}
                                    cy={isDark ? 7 : 7}
                                    r="7"
                                    fill="black"
                                    style={{
                                        transition: 'cx 0.35s ease-in-out',
                                    }}
                                />
                            </mask>
                        </defs>

                        {/* Main circle (sun body / moon body) */}
                        <circle
                            cx="12"
                            cy="12"
                            r={isDark ? 8 : 5}
                            mask="url(#moonMask)"
                            style={{
                                fill: isDark ? '#c4b5fd' : '#f59e0b',
                                transition: 'r 0.35s ease-in-out, fill 0.35s ease-in-out',
                            }}
                        />

                        {/* Sun rays – scale to 0 when dark */}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                            const rad = (angle * Math.PI) / 180;
                            const innerR = 7.5;
                            const outerR = 10;
                            const x1 = 12 + innerR * Math.cos(rad);
                            const y1 = 12 + innerR * Math.sin(rad);
                            const x2 = 12 + outerR * Math.cos(rad);
                            const y2 = 12 + outerR * Math.sin(rad);
                            return (
                                <line
                                    key={i}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={isDark ? '#c4b5fd' : '#f59e0b'}
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    style={{
                                        opacity: isDark ? 0 : 1,
                                        transform: isDark
                                            ? `scale(0) translate(${x1}px, ${y1}px)`
                                            : 'scale(1)',
                                        transformOrigin: `${x1}px ${y1}px`,
                                        transition: `opacity 0.3s ease-in-out ${isDark ? '0s' : `${0.03 * i}s`}, transform 0.35s ease-in-out ${isDark ? '0s' : `${0.03 * i}s`}, stroke 0.35s ease-in-out`,
                                    }}
                                />
                            );
                        })}
                    </svg>
                </div>
            </div>
        </button>
    );
}
