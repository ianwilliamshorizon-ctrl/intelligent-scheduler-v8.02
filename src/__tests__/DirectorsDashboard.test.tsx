
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
};

// Mock the useData hook
vi.mock('../../core/state/DataContext', () => ({
  ...vi.importActual('../../core/state/DataContext'),
  useData: () => mockData,
}));

// Mock child components that have their own complex logic
vi.mock('../../components/DirectorsDashboard/AIAssistant', () => () => <div>AIAssistant Mock</div>);
vi.mock('../../components/DirectorsDashboard/Charts', () => () => <div>Charts Mock</div>);

describe('DirectorsDashboard', () => {
  it('renders the main heading', () => {
    render(
      <DataProvider>
        <DirectorsDashboard />
      </DataProvider>
    );
    const heading = screen.getByText(/Directors Dashboard/i);
    expect(heading).toBeInTheDocument();

    // Check that child components are rendered
    expect(screen.getByText('AIAssistant Mock')).toBeInTheDocument();
    expect(screen.getByText('Charts Mock')).toBeInTheDocument();
  });
});
