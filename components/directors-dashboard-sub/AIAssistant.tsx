import React, { useState } from 'react';
import { useData } from '../../core/state/DataContext';
import { generateContent } from '../../core/services/geminiService';

interface AIAssistantProps {
    financialData?: {
        totals: any;
        chartData: any[];
    };
}

const AIAssistant: React.FC<AIAssistantProps> = ({ financialData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState('');

    const { businessEntities } = useData();

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

        // OPTIMIZATION: Use the dashboard's pre-calculated strategic data
        const summary = {
            currentOverview: financialData?.totals || {},
            strategicTrends: (financialData?.chartData || []).slice(-3), // Last 3 months context
            businessScale: {
                entities: businessEntities.map(e => ({ name: e.name, capacity: e.dailyCapacityHours }))
            }
        };

        const fullPrompt = `You are the Brookspeed Strategic Dashboard AI. 
        Analyze the following financial summary and trends for the director.
        
        Strategic Context:
        ${JSON.stringify(summary, null, 2)}
        
        Director's Question: "${currentPrompt}"
        
        Provide a sharp, data-driven insight. Use bold text for key figures.`;

        try {
            const text = await generateContent(fullPrompt);
            setResult(text);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setResult("I encountered an issue processing the full dataset. Please try a more specific question.");
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
