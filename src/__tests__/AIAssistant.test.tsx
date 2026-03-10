
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAssistant from '../../components/DirectorsDashboard/AIAssistant';
import { DataProvider } from '../../core/state/DataContext';

// Mock the DataContext
const mockData = {
  jobs: [],
  estimates: [],
  invoices: [],
  customers: [],
  vehicles: [],
  businessEntities: [],
};

// Mock the useData hook
vi.mock('../../core/state/DataContext', () => ({
  ...vi.importActual('../../core/state/DataContext'),
  useData: () => mockData,
}));

// Mock the GoogleGenerativeAI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(() => Promise.resolve({
        response: {
          text: () => 'This is a mock response.',
        },
      })),
    })),
  })),
}));

describe('AIAssistant', () => {
  it('renders the component and predispositioned actions', () => {
    render(
      <DataProvider>
        <AIAssistant />
      </DataProvider>
    );

    expect(screen.getByText('AI Insights Assistant')).toBeInTheDocument();
    expect(screen.getByText('Total Revenue Last Month')).toBeInTheDocument();
    expect(screen.getByText('Busiest Entity')).toBeInTheDocument();
    expect(screen.getByText('Average Job Value')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask a question about your data...')).toBeInTheDocument();
  });

  it('allows typing in the input and asking a question', async () => {
    render(
      <DataProvider>
        <AIAssistant />
      </DataProvider>
    );

    const input = screen.getByPlaceholderText('Ask a question about your data...');
    const askButton = screen.getByText('Ask');

    fireEvent.change(input, { target: { value: 'What is the meaning of life?' } });
    fireEvent.click(askButton);

    expect(askButton).toBeDisabled();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('This is a mock response.')).toBeInTheDocument();
    });

    expect(askButton).not.toBeDisabled();
  });
});
