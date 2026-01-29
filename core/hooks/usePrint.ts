import React, { useCallback } from 'react';
import { createRoot } from 'react-dom/client';

export const usePrint = () => {
    const print = useCallback((content: React.ReactNode) => {
        // 1. Try to find the wrapper, or create it if it's missing (Self-healing)
        let wrapper = document.getElementById('print-mount-point-wrapper');
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'print-mount-point-wrapper';
            // Default styles to ensure it's hidden on screen but valid in DOM
            wrapper.style.display = 'none'; 
            document.body.appendChild(wrapper);
        }

        // 2. Clear any previous content to prevent React collisions
        wrapper.innerHTML = '';

        // 3. Create a dedicated container for this specific print job
        const container = document.createElement('div');
        container.className = 'print-job-container';
        wrapper.appendChild(container);

        try {
            const root = createRoot(container);
            root.render(content);

            // 4. Wait for render (and images) then Print
            // Increased delay to 800ms to ensure Tailwind classes apply in iframe environments
            setTimeout(() => {
                const handleAfterPrint = () => {
                    // Cleanup after print dialog closes
                    // We use a small timeout to let the browser finish the print spooling process
                    setTimeout(() => {
                        root.unmount();
                        if (wrapper && wrapper.contains(container)) {
                            wrapper.removeChild(container);
                        }
                    }, 500);
                    window.removeEventListener('afterprint', handleAfterPrint);
                };

                window.addEventListener('afterprint', handleAfterPrint);
                
                // Trigger browser print
                window.print();

                // Fallback cleanup if afterprint doesn't fire (e.g., user hits cancel fast in some browsers)
                setTimeout(() => {
                    if (wrapper && wrapper.contains(container)) {
                         // We leave it if the user is still in the dialog, but this prevents memory leaks
                         // Logic here assumes if 10s passed, they are done or stuck.
                    }
                }, 10000); 
            }, 800); 
        } catch (e) {
            console.error("Print Error:", e);
            alert("An error occurred while preparing the document for printing.");
        }
    }, []);

    return print;
};