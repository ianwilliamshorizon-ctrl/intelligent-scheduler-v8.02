import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../core/state/DataContext';
import { RentalVehicle, RentalBooking, Vehicle, Customer, BusinessEntity, Job, RentalDriverDetails, DamagePoint } from '../types';
import { CarFront, PlusCircle, ChevronLeft, ChevronRight, Edit, FileText, Trash2, Save, X, Car, Fuel, Milestone, FilePenLine, Calendar, Clock } from 'lucide-react';
import { formatDate, dateStringToDate, addDays, daysBetween, getRelativeDate } from '../core/utils/dateUtils';
import { formatCurrency } from '../utils/formatUtils';
import { generateRentalBookingId } from '../utils/numberGenerators';
import SearchableSelect from '../components/SearchableSelect';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import FormModal from '../components/FormModal';
import VehicleDamageReport from '../components/VehicleDamageReport';
import AsyncImage from '../components/AsyncImage';


export const RentalCheckInCheckOutModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedBooking: RentalBooking) => void;
    booking: RentalBooking;
    mode: 'checkOut' | 'checkIn';
    rentalVehicle: RentalVehicle;
    vehicle: Vehicle;
}> = ({ isOpen, onClose, onSave, booking, mode, rentalVehicle, vehicle }) => {
    const [mileage, setMileage] = useState('');
    const [fuelLevel, setFuelLevel] = useState(50);
    const [conditionNotes, setConditionNotes] = useState('');
    const [damagePoints, setDamagePoints] = useState<DamagePoint[]>([]);
    const [additionalCharges, setAdditionalCharges] = useState<{ id: string; description: string; amount: number; }[]>([]);

    useEffect(() => {
        if (isOpen) {
            const details = mode === 'checkOut' ? booking.checkOutDetails : booking.checkInDetails;
            setMileage(details?.mileage?.toString() || '');
            setFuelLevel(details?.fuelLevel || 50);
            setConditionNotes(details?.conditionNotes || '');
            setDamagePoints(details?.damagePoints || (mode === 'checkIn' ? (booking.checkInDetails?.damagePoints || []) : booking.checkOutDetails?.damagePoints || []));
            setAdditionalCharges(booking.additionalCharges || []);
        }
    }, [isOpen, booking, mode]);

    const handleSave = () => {
        const updatedDetails = {
            mileage: parseInt(mileage, 10),
            fuelLevel,
            conditionNotes,
            timestamp: new Date().toISOString(),
            damagePoints
        };

        const updatedBooking = { ...booking };
        if (mode === 'checkOut') {
            updatedBooking.checkOutDetails = updatedDetails;
            updatedBooking.status = 'Active';
        } else {
            updatedBooking.checkInDetails = updatedDetails;
            updatedBooking.status = 'Completed';
            updatedBooking.additionalCharges = additionalCharges;
        }
        onSave(updatedBooking);
    };

    const handleAddCharge = () => setAdditionalCharges(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }]);
    const handleChargeChange = (id: string, field: 'description' | 'amount', value: string | number) => setAdditionalCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    const handleRemoveCharge = (id: string) => setAdditionalCharges(prev => prev.filter(c => c.id !== id));

    const diagramImageId = useMemo(() => {
        if (Array.isArray(vehicle.images)) {
            const primaryVehicleImage = vehicle.images.find(img => img.isPrimaryDiagram);
            if (primaryVehicleImage) {
                return primaryVehicleImage.id;
            }
        }
        return rentalVehicle.damageCheckImageId || null;
    }, [vehicle, rentalVehicle]);

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={`${mode === 'checkOut' ? 'Check Out' : 'Check In'} Vehicle: ${vehicle.registration}`} maxWidth="max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Milestone /> Mileage</label>
                        <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full p-2 border rounded" placeholder="Enter current mileage" />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Fuel /> Fuel Level: {fuelLevel}%</label>
                        <input type="range" min="0" max="100" step="5" value={fuelLevel} onChange={e => setFuelLevel(parseInt(e.target.value))} className="w-full" />
                    </div>
                     <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><FilePenLine /> Condition Notes</label>
                        <textarea value={conditionNotes} onChange={e => setConditionNotes(e.target.value)} rows={3} className="w-full p-2 border rounded" placeholder="e.g., small scratch on driver door" />
                    </div>
                     {mode === 'checkIn' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">Additional Charges</label>
                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                {additionalCharges.map(charge => (
                                    <div key={charge.id} className="flex items-center gap-2">
                                        <input type="text" value={charge.description} onChange={e => handleChargeChange(charge.id, 'description', e.target.value)} className="flex-grow p-1 border rounded text-sm" placeholder="Charge description" />
                                        <input type="number" value={charge.amount} onChange={e => handleChargeChange(charge.id, 'amount', parseFloat(e.target.value))} className="w-24 p-1 border rounded text-sm" placeholder="Amount" />
                                        <button onClick={() => handleRemoveCharge(charge.id)}><Trash2 size={16} className="text-red-500" /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddCharge} className="text-xs text-indigo-600 font-semibold mt-2">+ Add Charge</button>
                        </div>
                    )}
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Car /> Damage Report</label>
                    <p className="text-xs text-gray-500 mb-2">
                        {mode === 'checkOut' 
                            ? 'Click on the diagram to mark any existing damage.' 
                            : 'Check-out damage is marked in blue. Click to add new damage points in red.'
                        }
                    </p>
                    <VehicleDamageReport
                        activePoints={damagePoints}
                        onUpdate={setDamagePoints}
                        isReadOnly={false}
                        vehicleModel={vehicle.model}
                        imageId={diagramImageId}
                        activeColorClass={`bg-[${rentalVehicle.damageMarkerColors[mode]}]`}
                        referencePoints={mode === 'checkIn' && booking.checkOutDetails ? {
                            points: booking.checkOutDetails.damagePoints,
                            colorClass: `bg-[${rentalVehicle.damageMarkerColors.checkOut}]`
                        } : undefined}
                    />
                </div>
            </div>
        </FormModal>
    );
};

const getStartOfWeek = (date: Date): Date => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setUTCDate(diff));
};

const WeeklyTimeline: React.FC<{
    days: Date[];
    vehicles: RentalVehicle[];
    bookings: RentalBooking[];
    vehiclesById: Map<string, Vehicle>;
    customersById: Map<string, Customer>;
    onNewBooking: (vehicleId: string, date: Date) => void;
    onOpenBooking: (booking: RentalBooking) => void;
}> = ({ days, vehicles, bookings, vehiclesById, customersById, onNewBooking, onOpenBooking }) => {
    const weekStart = days[0];
    const weekEnd = addDays(weekStart, 7);

    return (
        <div className="grid grid-cols-[150px_1fr] h-full">
            <div className="font-semibold p-2 border-b border-r sticky top-0 bg-white z-10">Vehicle</div>
            <div className="grid grid-cols-7 border-b sticky top-0 bg-white z-10">
                {days.map((day: Date) => (
                    <div key={day.toISOString()} className="text-center font-semibold text-sm p-2 border-l">
                        {day.toLocaleDateString('en-GB', { weekday: 'short' })} <span className="text-gray-500">{day.getUTCDate()}</span>
                    </div>
                ))}
            </div>
            {vehicles.map((rv: RentalVehicle) => {
                const vehicle = vehiclesById.get(rv.id);
                return (
                    <React.Fragment key={rv.id}>
                        <div className="p-2 border-r border-t font-semibold text-sm flex items-center bg-gray-50 sticky left-0">{vehicle?.registration}</div>
                        <div className="grid grid-cols-7 border-t relative">
                            {days.map((day: Date) => <div key={day.toISOString()} className="p-1 border-l h-24 group relative" onClick={() => onNewBooking(rv.id, day)}><button className="absolute inset-0 w-full h-full text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><PlusCircle size={18}/></button></div>)}
                            {bookings.filter((b: RentalBooking) => b.rentalVehicleId === rv.id).map((booking: RentalBooking) => {
                                const start = dateStringToDate(booking.startDate.split('T')[0]);
                                const end = dateStringToDate(booking.endDate.split('T')[0]);

                                if (end < weekStart || start >= weekEnd) return null;

                                const startIndex = Math.max(0, daysBetween(weekStart, start));
                                const endIndex = Math.min(7, daysBetween(weekStart, end) + 1);
                                const duration = endIndex - startIndex;

                                if (duration <= 0) return null;

                                const customer = customersById.get(booking.customerId);
                                return (
                                    <div key={booking.id} onClick={() => onOpenBooking(booking)} className="absolute top-2 h-20 p-2 rounded-lg text-white bg-indigo-500 hover:bg-indigo-600 cursor-pointer shadow-lg z-10 flex flex-col justify-between" style={{ left: `calc(${(100 / 7) * startIndex}% + 4px)`, width: `calc(${(100 / 7) * duration}% - 8px)` }}>
                                        <p className="font-bold text-xs truncate">{getCustomerDisplayName(customer)}</p>
                                        <p className="text-[10px] truncate">{booking.bookingType === 'Courtesy Car' ? `Job: ${booking.jobId}` : formatCurrency(booking.totalCost)}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </React.Fragment>
                )
            })}
        </div>
    );
};

const MonthlyCalendar: React.FC<{
    month: Date;
    bookings: RentalBooking[];
    vehiclesById: Map<string, Vehicle>;
    customersById: Map<string, Customer>;
    onNewBooking: (date: Date) => void;
    onOpenBooking: (booking: RentalBooking) => void;
}> = ({ month, bookings, vehiclesById, customersById, onNewBooking, onOpenBooking }) => {
    
    const calendarDays = useMemo(() => {
        const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
        const days = [];
        const todayString = getRelativeDate(0);

        const bookingsByDate = new Map<string, RentalBooking[]>();
        bookings.forEach(booking => {
            const startDate = dateStringToDate(booking.startDate.split('T')[0]);
            const endDate = dateStringToDate(booking.endDate.split('T')[0]);
            let currentDate = new Date(startDate);
            while(currentDate <= endDate) {
                const dateStr = formatDate(currentDate);
                if (!bookingsByDate.has(dateStr)) bookingsByDate.set(dateStr, []);
                bookingsByDate.get(dateStr)!.push(booking);
                currentDate = addDays(currentDate, 1);
            }
        });

        for (let i = 0; i < start.getUTCDay(); i++) {
            days.push({ key: `empty-start-${i}`, isPlaceholder: true });
        }
        
        for (let day = 1; day <= end.getUTCDate(); day++) {
            const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
            const dateString = formatDate(date);
            const dailyBookings = bookingsByDate.get(dateString) || [];
            dailyBookings.sort((a,b) => (vehiclesById.get(a.rentalVehicleId)?.registration || '').localeCompare(vehiclesById.get(b.rentalVehicleId)?.registration || ''));

            days.push({ 
                key: dateString, 
                isPlaceholder: false, 
                day, 
                date,
                dateString, 
                isToday: dateString === todayString, 
                bookings: dailyBookings,
            });
        }
        
        const totalCells = start.getUTCDay() + end.getUTCDate();
        const numRows = totalCells > 35 ? 42 : 35;

        while (days.length < numRows) {
             days.push({ key: `empty-end-${days.length}`, isPlaceholder: true });
        }
        return days;
    }, [month, bookings, vehiclesById]);

    const gridRowsClass = calendarDays.length > 35 ? 'grid-rows-6' : 'grid-rows-5';

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 text-xs font-bold text-center text-gray-500 border-b pb-2 mb-2 flex-shrink-0">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="flex-grow min-h-0">
                <div className={`grid grid-cols-7 ${gridRowsClass} gap-2 h-full`}>
                    {calendarDays.map(dayInfo => {
                        if (dayInfo.isPlaceholder) {
                            return <div key={dayInfo.key} className="bg-gray-50 rounded-lg"></div>;
                        }

                        return (
                            <div 
                                key={dayInfo.key} 
                                className={`group border rounded-lg p-2 flex flex-col relative transition duration-200 h-full
                                    ${dayInfo.isToday ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}
                                `}
                            >
                                <div className="flex justify-between items-start flex-shrink-0">
                                    <span className={`text-sm font-semibold ${dayInfo.isToday ? 'text-indigo-600' : 'text-gray-700'}`}>{dayInfo.day}</span>
                                </div>
                                
                                <div className="flex-1 min-h-0 overflow-y-auto mt-1 space-y-1 pr-1">
                                    {dayInfo.bookings.map(booking => {
                                        const vehicle = vehiclesById.get(booking.rentalVehicleId);
                                        const customer = customersById.get(booking.customerId);
                                        return (
                                            <div 
                                                key={booking.id} 
                                                onClick={() => onOpenBooking(booking)}
                                                className="p-1 rounded-md text-xs bg-indigo-100 text-indigo-800 cursor-pointer hover:bg-indigo-200"
                                                title={`${getCustomerDisplayName(customer)} - ${booking.bookingType}`}
                                            >
                                                <p className="font-semibold truncate flex items-center gap-1">
                                                    <Car size={12} /> {vehicle?.registration}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button 
                                    onClick={(e) => { e.stopPropagation(); onNewBooking(dayInfo.date); }} 
                                    className="absolute bottom-1 right-1 p-1 text-indigo-500 rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <PlusCircle size={20} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};


interface RentalsViewProps {
    entity: BusinessEntity;
    onOpenRentalBooking: (booking: Partial<RentalBooking> | null) => void;
}

const RentalsView: React.FC<RentalsViewProps> = ({ entity, onOpenRentalBooking }) => {
    const { rentalVehicles, rentalBookings, vehicles, customers } = useData();
    const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');
    
    const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
    const [currentMonth, setCurrentMonth] = useState(() => new Date());

    const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
    const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    const handlePrev = () => viewMode === 'timeline' ? setWeekStart(prev => addDays(prev, -7)) : handleMonthChange(-1);
    const handleNext = () => viewMode === 'timeline' ? setWeekStart(prev => addDays(prev, 7)) : handleMonthChange(1);
    const handleToday = () => viewMode === 'timeline' ? setWeekStart(getStartOfWeek(new Date())) : setCurrentMonth(new Date());

    const handleMonthChange = (offset: number) => {
        setCurrentMonth(prev => {
            const newDate = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            newDate.setUTCMonth(newDate.getUTCMonth() + offset);
            return newDate;
        });
    };
    
    const handleNewBookingTimeline = (rentalVehicleId: string, date: Date) => {
        const dateString = formatDate(date);
        onOpenRentalBooking({ rentalVehicleId, startDate: `${dateString}T09:00`, endDate: `${dateString}T17:00` });
    };

    const handleNewBookingCalendar = (date: Date) => {
        const dateString = formatDate(date);
        onOpenRentalBooking({ startDate: `${dateString}T09:00`, endDate: `${dateString}T17:00` });
    };

    const daysOfWeek = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);
    const currentMonthString = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    return (
        <div className="w-full h-full flex flex-col p-6">
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Courtesy Car & Rental Management</h2>
                    <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
                        <button onClick={handlePrev} className="p-2 rounded-md hover:bg-gray-300"><ChevronLeft /></button>
                        <button onClick={handleToday} className="p-2 rounded-md hover:bg-gray-300 text-sm font-semibold">Today</button>
                        <button onClick={handleNext} className="p-2 rounded-md hover:bg-gray-300"><ChevronRight /></button>
                    </div>
                    {viewMode === 'monthly' && <span className="text-lg font-semibold">{currentMonthString}</span>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-1 p-1 bg-gray-200 rounded-lg">
                        <button onClick={() => setViewMode('timeline')} className={`p-2 rounded-md transition ${viewMode === 'timeline' ? 'bg-white shadow' : ''}`} title="Weekly Timeline View"><Clock size={16}/></button>
                        <button onClick={() => setViewMode('monthly')} className={`p-2 rounded-md transition ${viewMode === 'monthly' ? 'bg-white shadow' : ''}`} title="Monthly Calendar View"><Calendar size={16}/></button>
                    </div>
                    <button onClick={() => onOpenRentalBooking(null)} className="flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                        <PlusCircle size={16}/> New Booking
                    </button>
                </div>
            </header>
            
            <main className="flex-grow overflow-y-auto bg-white rounded-lg shadow p-4">
                {viewMode === 'timeline' ? (
                     <WeeklyTimeline days={daysOfWeek} vehicles={rentalVehicles} bookings={rentalBookings} vehiclesById={vehiclesById} customersById={customersById} onNewBooking={handleNewBookingTimeline} onOpenBooking={onOpenRentalBooking} />
                ) : (
                    <MonthlyCalendar month={currentMonth} bookings={rentalBookings} vehiclesById={vehiclesById} customersById={customersById} onNewBooking={handleNewBookingCalendar} onOpenBooking={onOpenRentalBooking} />
                )}
            </main>
        </div>
    )
};
export default RentalsView;