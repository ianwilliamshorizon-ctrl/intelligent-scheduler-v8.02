
import { render, screen, fireEvent } from '@testing-library/react';
import DirectorsDashboard from '../../components/DirectorsDashboard';
import { DataProvider } from '../../core/state/DataContext';

// Mock the DataContext to prevent errors from child components that use it
const mockData = {
  jobs: [
    {
      id: 'job-1',
      entityId: 'ent-1',
      description: 'Major Service',
      scheduledDate: '2026-03-15T10:00:00Z',
      status: 'Booked In',
      lineItems: [
        { id: 'li-1', description: 'Labor', quantity: 2, unitPrice: 100, unitCost: 40, isLabor: true },
        { id: 'li-2', description: 'Oil Filter', quantity: 1, unitPrice: 50, unitCost: 20 }
      ]
    }
  ],
  estimates: [
    {
      id: 'est-1',
      entityId: 'ent-1',
      issueDate: '2026-03-10T10:00:00Z',
      status: 'Converted to Job',
      jobId: 'job-1',
      lineItems: [
        { id: 'li-est-1', description: 'Brake Disc Replacement', quantity: 1, unitPrice: 300, unitCost: 120 }
      ]
    }
  ],
  invoices: [
    {
      id: 'inv-1',
      entityId: 'ent-1',
      issueDate: '2026-03-20T10:00:00Z',
      status: 'Paid',
      totalAmount: 250,
      lineItems: []
    }
  ],
  purchaseOrders: [
    {
      id: 'po-1',
      entityId: 'ent-1',
      orderDate: '2026-03-12T10:00:00Z',
      status: 'Received',
      lineItems: [
        { id: 'po-li-1', partNumber: 'OIL-01', description: 'Mobil 1 Engine Oil', quantity: 2, unitPrice: 30 }
      ]
    }
  ],
  customers: [],
  vehicles: [],
  businessEntities: [
    { id: 'ent-1', name: 'Brookspeed Workshop' }
  ],
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
  it('renders the main heading and default overview tab', () => {
    render(
      <DataProvider>
        <DirectorsDashboard />
      </DataProvider>
    );
    const heading = screen.getByText(/Business Summary/i);
    expect(heading).toBeInTheDocument();

    // Check that tab navigation buttons exist
    expect(screen.getByRole('button', { name: /Executive Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Month-by-Month KPIs/i })).toBeInTheDocument();

    // Check that child components are rendered for Overview tab
    expect(screen.getByText('AIAssistant Mock')).toBeInTheDocument();
    expect(screen.getAllByText('Charts Mock').length).toBe(3);
  });

  it('switches to Month-by-Month KPIs tab and displays metrics', () => {
    render(
      <DataProvider>
        <DirectorsDashboard />
      </DataProvider>
    );

    const kpiTabButton = screen.getByRole('button', { name: /Month-by-Month KPIs/i });
    fireEvent.click(kpiTabButton);

    // Verify Month-by-Month KPI tab elements
    expect(screen.getByText('Month-by-Month Business KPIs')).toBeInTheDocument();
    expect(screen.getByText(/Export Monthly KPIs \(CSV\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Estimates Quoted/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bookings \(Jobs\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Purchase Orders/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/YEAR 2026 TOTAL \/ AVG/i)).toBeInTheDocument();
  });
});

