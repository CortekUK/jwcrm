import type { Answers } from '@/types/will-form';

interface QueuedSave {
  willId: string;
  answers: Answers;
  timestamp: string;
}

const QUEUE_KEY = 'will_save_queue';

export function queueOfflineSave(willId: string, answers: Answers) {
  try {
    const queue = getQueue();
    const newSave: QueuedSave = {
      willId,
      answers,
      timestamp: new Date().toISOString(),
    };
    
    // Replace existing save for this will if any
    const filteredQueue = queue.filter(item => item.willId !== willId);
    filteredQueue.push(newSave);
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filteredQueue));
    console.log('Queued offline save for will:', willId);
  } catch (error) {
    console.error('Failed to queue offline save:', error);
  }
}

export function getQueue(): QueuedSave[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get save queue:', error);
    return [];
  }
}

export function clearQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
    console.log('Cleared save queue');
  } catch (error) {
    console.error('Failed to clear queue:', error);
  }
}

export function removeFromQueue(willId: string) {
  try {
    const queue = getQueue();
    const filtered = queue.filter(item => item.willId !== willId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log('Removed will from queue:', willId);
  } catch (error) {
    console.error('Failed to remove from queue:', error);
  }
}
