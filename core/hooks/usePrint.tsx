import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';

export const usePrint = () => {
    const print = useCallback((content: React.ReactNode) => {
        // 1. Find the wrapper defined in index.html
        let wrapper = document.getElementById('print-mount-point-wrapper');
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'print-mount-point-wrapper';
            document.body.appendChild(wrapper);
        }

        // 2. Clear previous content
        wrapper.innerHTML = '';

        // 3. Create a dedicated container for this print job
        const container = document.createElement('div');
        container.className = 'print-job-container';
        wrapper.appendChild(container);

        try {
            const root = createRoot(container);
            root.render(content);

            // 4. Wait for React to mount and images to settle (1.5s is safest)
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
            }, 1500); 
        } catch (e) {
            console.error("Print Error:", e);
        }
    }, []);

    return print;
};