
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAssistant from '../../components/directors-dashboard-sub/AIAssistant';
import { DataProvider } from '../../core/state/DataContext';

// Mock the DataContext
const mockData = {
  jobs: [],
  estimates: [],
  invoices: [],
  customers: [],
  vehicles: [],
  businessEntities: [],
  financialBaselines: [],
  isDataLoaded: true,
};

// Mock the useData hook
vi.mock('../../core/state/DataContext', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    DataProvider: ({ children }) => <>{children}</>,
    useData: () => mockData,
  };
});

// Mock the geminiService
vi.mock('../../core/services/geminiService', () => ({
  generateContent: vi.fn(() => Promise.resolve('This is a mock response.')),
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
    expect(screen.getByPlaceholderText('How can I help you understand your data today?')).toBeInTheDocument();
  });

  it('allows typing in the input and asking a question', async () => {
    render(
      <DataProvider>
        <AIAssistant />
      </DataProvider>
    );

    const input = screen.getByPlaceholderText('How can I help you understand your data today?');
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
