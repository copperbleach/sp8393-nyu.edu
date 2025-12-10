import React, { useState, useEffect } from 'react';
import { ActiveEvent } from '../types';

interface EventNotificationProps {
    event: ActiveEvent;
}

const EventNotification: React.FC<EventNotificationProps> = ({ event }) => {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(event.duration));

  useEffect(() => {
    const update = () => {
      const elapsed = (performance.now() - event.startTime) / 1000;
      const remaining = Math.ceil(event.duration - elapsed);
      setTimeLeft(Math.max(0, remaining));
    };

    update();
    const intervalId = setInterval(update, 500);
    return () => clearInterval(intervalId);
  }, [event.id, event.startTime, event.duration]);

  if (timeLeft <= 0) return null;

  return (
    <div className="bg-white bg-opacity-90 backdrop-blur-sm p-4 rounded-lg shadow-lg text-center border border-gray-200 mb-2 w-64 animate-fade-in-down">
      <h3 className="font-bold text-lg text-gray-800">{event.name}</h3>
      <p className="text-sm text-gray-600">{event.description}</p>
      <p className="text-xl font-bold text-blue-500 mt-2">{timeLeft}s</p>
    </div>
  );
};

export default EventNotification;
