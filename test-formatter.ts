import { formatWhatsAppMessage } from './lib/whatsappFormatter';

const testPlanning = {
    date: '2026-02-18',
    blocks: [
        {
            projectId: '1',
            projectName: 'Montaje Extractor',
            startTime: '07:00',
            operatorIds: ['1', '2'],
            operatorNames: ['Nicolás Santa Cruz', 'Fernando Juarez']
        },
        {
            projectId: '2',
            projectName: 'Taller',
            startTime: '08:00',
            endTime: '12:00',
            operatorIds: ['3'],
            operatorNames: ['Gianluca Bessone']
        }
    ]
};

console.log('--- WHATSAPP MESSAGE START ---');
console.log(formatWhatsAppMessage(testPlanning));
console.log('--- WHATSAPP MESSAGE END ---');
