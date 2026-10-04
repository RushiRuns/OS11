import React from 'react';
import { DatePicker } from '../../components/DatePicker/DatePicker.js';

export interface WhenPopoverProps {
  initialDate?: string | null;
  initialTime?: string | null;
  initialAllDay?: boolean;
  initialBucket?: 'anytime' | 'someday' | null;
  position?: { x: number; y: number };
  onSelectDate: (date: string | null, time: string | null, allDay: boolean) => void;
  onSelectBucket: (bucket: 'anytime' | 'someday' | null) => void;
  onClose: () => void;
}

export function WhenPopover({
  initialDate,
  initialTime,
  initialAllDay,
  initialBucket,
  position,
  onSelectDate,
  onSelectBucket,
  onClose,
}: WhenPopoverProps): React.ReactElement {
  return (
    <DatePicker
      initialDate={initialDate}
      initialTime={initialTime}
      initialAllDay={initialAllDay}
      initialBucket={initialBucket}
      position={position}
      onSelect={onSelectDate}
      onSelectBucket={onSelectBucket}
      onClose={onClose}
    />
  );
}

export default WhenPopover;
