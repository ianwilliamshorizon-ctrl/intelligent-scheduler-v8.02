import React, { useState } from 'react';
import { useData } from '../../core/state/DataContext';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the AI model directly, using the same key as LiveAssistant.tsx
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const AIAssistant: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState('');

    const { jobs, estimates, invoices, customers, vehicles, businessEntities } = useData();

    const formatMessage = (text: string) => {
        return text.split('\n').map((line, i) => {
            let processedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^\* (.*)/, '• $1')
                .replace(/^# (.*)/, '<h3 class="font-bold text-base mt-2">$1</h3>');

            return (
                <div 
                    key={i} 
                    className={processedLine.trim() === '' ? 'h-3' : 'mb-1'}
                    dangerouslySetInnerHTML={{ __html: processedLine }} 
                />
            );
        });
    };

    const handlePrompt = async (currentPrompt: string) => {
        if (!currentPrompt) return;
        setIsLoading(true);
        setResult('');

        const dataContext = JSON.stringify({ jobs, estimates, invoices, customers, vehicles, businessEntities });
        const fullPrompt = `Based on the following data, answer the question: "${currentPrompt}"\n\nData:\n${dataContext}`;

        try {
            // Use the same model as LiveAssistant.tsx to ensure key compatibility
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
            const generationResult = await model.generateContent(fullPrompt);
            const response = await generationResult.response;
            const text = response.text();
            setResult(text);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setResult("Sorry, I encountered an error. Please ensure your API key is valid and has access to the model.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePredisposedAction = (action: string) => {
        setPrompt(action);
        handlePrompt(action);
    };

    const onPromptButtonClick = () => {
        handlePrompt(prompt);
    }

    return (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">AI Insights Assistant</h3>
            
            <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => handlePredisposedAction('Show me the total revenue for last month')} className="px-3 py-1 bg-gray-200 text-sm rounded-full hover:bg-gray-300 transition-colors">Total Revenue Last Month</button>
                <button onClick={() => handlePredisposedAction('Which business entity has the most jobs?')} className="px-3 py-1 bg-gray-200 text-sm rounded-full hover:bg-gray-300 transition-colors">Busiest Entity</button>
                <button onClick={() => handlePredisposedAction('What is the average job value?')} className="px-3 py-1 bg-gray-200 text-sm rounded-full hover:bg-gray-300 transition-colors">Average Job Value</button>
            </div>

            <div className="flex gap-2">
                <input 
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Ask a question about your data..."
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={onPromptButtonClick} disabled={isLoading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors">
                    {isLoading ? 'Thinking...' : 'Ask'}
                </button>
            </div>

            {result && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-gray-700 leading-relaxed">{formatMessage(result)}</div>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;