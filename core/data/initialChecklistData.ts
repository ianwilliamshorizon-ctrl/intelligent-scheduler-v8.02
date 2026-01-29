import { ChecklistSection, ChecklistItemStatus, TyreCheckData } from '../../types';

const createDefaultItems = (labels: string[]): { id: string; label: string; status: ChecklistItemStatus; }[] =>
  labels.map(label => ({
    id: `item_${crypto.randomUUID()}`,
    label,
    status: 'na', // Default to Not Applicable
  }));

export const initialChecklistData: ChecklistSection[] = [
  {
    id: 'section_interior_electrics',
    title: 'Vehicle Interior and Electrics',
    items: createDefaultItems([
      'Check condition and operation of all seat belts',
      'Check condition and operation of all foot pedals (inc. rubbers)',
      'Check battery condition with test machine',
      'Check function of all exterior lights (inc. static cornering lights)',
      'Check function of interior lights (inc. glovebox and boot light)',
      'Check function of all instrument warning lamps',
      'Check function of horn',
      'Perform vehicle systems check with diagnostic test machine',
    ]),
  },
  {
    id: 'section_exterior',
    title: 'Vehicle Exterior',
    items: createDefaultItems([
      'Grease all door, bonnet and boot hinges, catches and latches',
      'Check front and rear wash/wipe system and adjust settings (if required)',
      'Check condition and park position of wiper blades (adjust if required)',
      'Windscreen, carry out visual check',
    ]),
  },
  {
    id: 'section_engine_compartment',
    title: 'Engine Compartment',
    items: createDefaultItems([
        'Replenish engine oil to maximum mark with correct grade',
        'Visual check of engine and components in engine bay (inc. pipes & hoses)',
        'Clean air filter housing and replace filter element',
        'Replace fuel filter (diesel engines only)',
        'Replace spark plugs (petrol engines only)',
        'Check level of wash/wipe system, additive strength and top up (if required)',
        'Check level and frost protection of cooling system',
        'Check oil level of power steering system (if applicable)',
        'Check brake fluid level (depending on pad wear)',
        'Clean pollen filter housing and replace filter element',
    ]),
  },
  {
    id: 'section_vehicle_below',
    title: 'Vehicle from Below',
    items: createDefaultItems([
      'Drain engine oil and replace oil filter',
      'Check condition of auxiliary drive belts and adjust (if required)',
      'Visual check of gearbox and final drive for leaks',
      'Check manual/auto gearbox oil level and replenish (if required)',
      'Check final drive oil level and replenish (if required)',
      'Visual check of drive shaft gaiters',
      'Visual check of braking system components',
      'Remove all wheels for full inspection of braking system',
      'Check condition of front and rear brake linings (advise %age wear)',
      'Visual check of suspension system',
      'Visual check of underbody panels, plugs, grommets and sealant',
      'Visual check of entire exhaust system',
      'Check play, security and boots of track rod ends',
      'Visual check of all swivel joints',
      'Visually check security of all lines and cables (eg. fuel lines & handbrake cables)',
    ]),
  },
  {
    id: 'section_final_checks',
    title: 'Final Checks',
    items: createDefaultItems([
        'Check headlight adjustment',
        'Reset service interval display',
        'Perform vehicle road test',
        "BROOKSPEED stamp in customer's service book",
    ]),
  },
];

export const initialTyreCheckData: TyreCheckData = {
  frontRight: { indicator: 'na' },
  frontLeft: { indicator: 'na' },
  rearRight: { indicator: 'na' },
  rearLeft: { indicator: 'na' },
  spare: { indicator: 'na' },
};