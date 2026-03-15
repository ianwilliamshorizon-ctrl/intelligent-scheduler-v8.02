import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';

export const usePrint = () => {
    const print = useCallback((content: React.ReactNode) => {
        // 1. Find or create the wrapper
        let wrapper = document.getElementById('print-mount-point-wrapper');
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'print-mount-point-wrapper';
            
            // INJECT PRINT CSS: This is the critical part.
            // It hides everything else and shows only the wrapper during printing.
            const style = document.createElement('style');
            style.innerHTML = `
                @media screen {
                    #print-mount-point-wrapper { display: none !important; }
                }
                @media print {
                    body > *:not(#print-mount-point-wrapper) {
                        display: none !important;
                    }
                    #print-mount-point-wrapper {
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrapper);
        }

        // 2. Clear previous content
        wrapper.innerHTML = '';

        // 3. Create a dedicated container
        const container = document.createElement('div');
        container.className = 'print-job-container';
        wrapper.appendChild(container);

        try {
            const root = createRoot(container);
            root.render(content);

            // 4. Wait for React to mount and styles to settle
            setTimeout(() => {
                const handleAfterPrint = () => {
                    setTimeout(() => {
                        root.unmount();
                        if (wrapper && wrapper.contains(container)) {
                            wrapper.removeChild(container);
                        }
                    }, 500);
                    window.removeEventListener('afterprint', handleAfterPrint);
                };

                window.addEventListener('afterprint', handleAfterPrint);
                
                // Trigger print
                window.print();
            }, 1000); // 1s delay is safer for logos/images to load
        } catch (e) {
            console.error("Print Error:", e);
        }
    }, []);

    return print;
};