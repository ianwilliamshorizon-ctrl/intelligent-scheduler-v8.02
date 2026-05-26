
import { render, screen } from '@testing-library/react';
import DirectorsDashboard from '../../components/DirectorsDashboard';
import { DataProvider } from '../../core/state/DataContext';

// Mock the DataContext to prevent errors from child components that use it
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

// Mock child components that have their own complex logic
vi.mock('../../components/directors-dashboard-sub/AIAssistant', () => ({ default: () => <div>AIAssistant Mock</div> }));
vi.mock('../../components/directors-dashboard-sub/charts', () => ({
  SimpleLineChart: () => <div>Charts Mock</div>,
  SimpleBarChart: () => <div>Charts Mock</div>,
}));

describe('DirectorsDashboard', () => {
  it('renders the main heading', () => {
    render(
      <DataProvider>
        <DirectorsDashboard />
      </DataProvider>
    );
    const heading = screen.getByText(/Business Summary/i);
    expect(heading).toBeInTheDocument();

    // Check that child components are rendered
    expect(screen.getByText('AIAssistant Mock')).toBeInTheDocument();
    expect(screen.getAllByText('Charts Mock').length).toBe(3);
  });
});
