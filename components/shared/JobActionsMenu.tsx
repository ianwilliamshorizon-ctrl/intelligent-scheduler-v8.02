import React, { useState, useRef, useEffect } from 'react';
import { 
    MoreHorizontal, 
    MoreVertical, 
    PlayCircle, 
    PauseCircle, 
    CheckCircle, 
    Wand2, 
    Edit, 
    UserCog, 
    Trash2, 
    ChevronRight,
    LucideIcon
} from 'lucide-react';

interface JobAction {
    id: string;
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
    group?: 'primary' | 'secondary' | 'danger';
}

interface JobActionsMenuProps {
    actions: JobAction[];
    colorScheme?: 'light' | 'dark' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    title?: string;
    onOpenChange?: (isOpen: boolean) => void;
}

export const JobActionsMenu: React.FC<JobActionsMenuProps> = ({ 
    actions, 
    colorScheme = 'glass', 
    size = 'sm',
    disabled = false,
    title,
    onOpenChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [direction, setDirection] = useState<'up' | 'down'>('down');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 260) { // If less than 260px below, open up
                setDirection('up');
            } else {
                setDirection('down');
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                onOpenChange?.(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleActionClick = (e: React.MouseEvent, action: JobAction) => {
        e.preventDefault();
        e.stopPropagation();
        if (action.disabled) return;
        
        setIsOpen(false);
        onOpenChange?.(false);
        
        // Use timeout to ensure menu closes before complex actions (like opening a modal) block the thread
        setTimeout(() => {
            action.onClick();
        }, 10);
    };

    const groupedActions = {
        primary: actions.filter(a => a.group === 'primary' || !a.group),
        secondary: actions.filter(a => a.group === 'secondary'),
        danger: actions.filter(a => a.group === 'danger'),
    };

    const sizeClasses = {
        sm: 'p-1',
        md: 'p-1.5',
        lg: 'p-2'
    };

    const buttonTheme = {
        light: 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200',
        dark: 'bg-gray-800 text-white hover:bg-gray-700',
        glass: 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/20 shadow-sm'
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={(e) => { 
                    e.stopPropagation(); 
                    const nextState = !isOpen;
                    setIsOpen(nextState); 
                    onOpenChange?.(nextState);
                }}
                disabled={disabled}
                className={`rounded-md transition-all active:scale-95 ${sizeClasses[size]} ${buttonTheme[colorScheme]} cursor-pointer`}
                title="Management Actions"
            >
                <MoreVertical size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
            </button>

            {isOpen && (
                <div className={`
                    absolute right-0 w-56 
                    ${direction === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'}
                    bg-white/95 backdrop-blur-md 
                    rounded-xl shadow-2xl border border-gray-200/50 
                    z-[1010] overflow-hidden 
                    animate-in fade-in ${direction === 'down' ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'} duration-200
                `}>
                    {title && (
                        <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b">
                            {title}
                        </div>
                    )}
                    
                    <div className="py-1">
                        {groupedActions.primary.length > 0 && (
                            <div className="space-y-0.5">
                                {groupedActions.primary.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={(e) => handleActionClick(e, action)}
                                        disabled={action.disabled}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 text-sm 
                                            transition-colors hover:bg-indigo-50 group
                                            ${action.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-gray-700'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <action.icon size={16} className={`group-hover:text-indigo-600 ${action.color || ''}`} />
                                            <span className="font-semibold">{action.label}</span>
                                        </div>
                                        <ChevronRight size={12} className="text-gray-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {(groupedActions.secondary.length > 0 && groupedActions.primary.length > 0) && <div className="h-px bg-gray-100 my-1 mx-2" />}

                        {groupedActions.secondary.length > 0 && (
                            <div className="space-y-0.5">
                                {groupedActions.secondary.map(action => (
                                    <button
                                        key={action.id}
                                        onClick={(e) => handleActionClick(e, action)}
                                        disabled={action.disabled}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 text-sm 
                                            transition-colors hover:bg-gray-100 group
                                            ${action.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-gray-600'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <action.icon size={16} className="group-hover:text-gray-900" />
                                            <span>{action.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {groupedActions.danger.length > 0 && (
                            <>
                                <div className="h-px bg-gray-100 my-1 mx-2" />
                                <div className="space-y-0.5">
                                    {groupedActions.danger.map(action => (
                                        <button
                                            key={action.id}
                                            onClick={(e) => handleActionClick(e, action)}
                                            disabled={action.disabled}
                                            className={`
                                                w-full flex items-center gap-2 px-3 py-2 text-sm 
                                                transition-colors hover:bg-red-50 text-red-600
                                                ${action.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                            `}
                                        >
                                            <action.icon size={16} />
                                            <span className="font-semibold">{action.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
