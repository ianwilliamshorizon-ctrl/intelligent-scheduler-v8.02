import { useState, useEffect } from 'react';
import { Drawer, List, ListItemButton, ListItemText, Typography, Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const sopFiles = [
  '01-user-and-role-management.md',
  '02-customer-and-vehicle-management.md',
  '03-creating-and-managing-estimates.md',
  '04-managing-jobs.md',
  '05-parts-and-inventory-management.md',
  '06-invoicing-and-payments.md',
  '07-data-import-and-export.md',
];

const HelpCentre = ({ open, onClose }) => {
  const [sops, setSops] = useState([]);
  const [selectedSop, setSelectedSop] = useState(null);

  useEffect(() => {
    const fetchSops = async () => {
      const fetchedSops = await Promise.all(
        sopFiles.map(async (file) => {
          const response = await fetch(`/help/${file}`);
          const title = file.replace(/\d+-/g, '').replace(/\.md$/, '').replace(/-/g, ' ');
          const content = await response.text();
          return { title, content };
        })
      );
      setSops(fetchedSops);
      if (fetchedSops.length > 0) {
        setSelectedSop(fetchedSops[0]);
      }
    };

    fetchSops();
  }, []);

  const handleSelectSop = (sop) => {
    setSelectedSop(sop);
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: 9999 }}>
      <Box sx={{ width: '80vw', maxWidth: 900, display: 'flex', height: '100vh' }}>
        {/* Sidebar for SOP titles - WIDENED */}
        <Box sx={{ width: 320, borderRight: '1px solid #ddd', overflowY: 'auto', flexShrink: 0 }}>
          <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid #ddd' }}>Help Centre</Typography>
          <List sx={{ p: 1 }}>
            {sops.map((sop, index) => (
              <ListItemButton key={index} onClick={() => handleSelectSop(sop)} selected={sop.title === selectedSop?.title} sx={{ borderRadius: '8px', mb: 0.5 }}>
                <ListItemText 
                  primary={sop.title}
                  primaryTypographyProps={{
                    sx: {
                      textTransform: 'capitalize',
                      whiteSpace: 'normal',
                      lineHeight: '1.4',
                      fontWeight: 500,
                    }
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Main content area for selected SOP - with enhanced styling */}
        <Box sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 5 },
          overflowY: 'auto',
          backgroundColor: '#fcfcfc',
          color: '#333',
          lineHeight: 1.7,
          '& h1': { fontSize: '2.25rem', fontWeight: 700, mb: 2, mt: 1, borderBottom: '1px solid #e0e0e0', pb: 1, color: '#111' },
          '& h2': { fontSize: '1.75rem', fontWeight: 600, mb: 2, mt: 4, color: '#222' },
          '& h3': { fontSize: '1.25rem', fontWeight: 600, mb: 2, mt: 3, color: '#333' },
          '& p': { mb: 2 },
          '& ul, & ol': { mb: 2, pl: 3 },
          '& li': { mb: 1 },
          '& table': { width: '100%', borderCollapse: 'collapse', mb: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', backgroundColor: 'white', border: '1px solid #ddd' },
          '& th': { backgroundColor: '#f7f7f7', p: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #ddd' },
          '& td': { p: '12px 16px', border: '1px solid #e8e8e8' },
          '& tr:nth-of-type(even)': { backgroundColor: '#fdfdfd' },
          '& hr': { my: 4, borderColor: '#ddd' },
          '& strong': { fontWeight: 600 },
          '& code': { backgroundColor: '#eee', p: '2px 4px', borderRadius: '4px', fontSize: '0.9em' },
          '& a': { color: '#1976d2', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        }}>
          {selectedSop ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedSop.content}
            </ReactMarkdown>
          ) : (
            <Typography>Select a topic to view the SOP.</Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default HelpCentre;
