/**
 * settlegrid-first-aid — First Aid Guide MCP Server
 *
 * Provides first aid instructions for common emergencies,
 * CPR steps, and emergency contact information.
 *
 * Methods:
 *   get_instructions(condition)   — Get first aid steps             (1c)
 *   get_emergency_numbers(country?) — Emergency phone numbers       (1c)
 *   get_cpr_guide(age_group?)      — CPR instructions              (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetInstructionsInput { condition: string }
interface GetEmergencyInput { country?: string }
interface GetCprInput { age_group?: string }

const CONDITIONS: Record<string, { severity: string; steps: string[]; when_to_call_911: string; do_not: string[] }> = {
  choking: { severity: 'high', steps: ['Encourage coughing if conscious', 'Give 5 back blows between shoulder blades', 'Give 5 abdominal thrusts (Heimlich)', 'Alternate back blows and thrusts', 'If unconscious, begin CPR'], when_to_call_911: 'If person cannot breathe, talk, or cough', do_not: ['Do NOT put fingers in mouth', 'Do NOT give water while choking'] },
  burns: { severity: 'medium', steps: ['Remove from heat source', 'Cool with running water 10-20 minutes', 'Remove jewelry/clothing near burn', 'Cover with sterile gauze loosely', 'Take OTC pain relief if needed'], when_to_call_911: 'Burns larger than palm, face/joint/genital burns, or chemical/electrical burns', do_not: ['Do NOT apply ice directly', 'Do NOT pop blisters', 'Do NOT apply butter or toothpaste'] },
  bleeding: { severity: 'high', steps: ['Apply firm direct pressure with clean cloth', 'Keep pressure for at least 15 minutes', 'Add more cloth if soaked through', 'Elevate wounded area above heart', 'Apply tourniquet ONLY as last resort'], when_to_call_911: 'Spurting blood, wound won\'t stop bleeding after 15 min, deep wound', do_not: ['Do NOT remove embedded objects', 'Do NOT peek at wound frequently'] },
  fracture: { severity: 'medium', steps: ['Immobilize the injured area', 'Apply ice wrapped in cloth', 'Elevate if possible', 'Support with splint or padding', 'Monitor circulation below injury'], when_to_call_911: 'Obvious deformity, bone protruding, loss of sensation, suspected spine/neck injury', do_not: ['Do NOT try to realign bone', 'Do NOT apply heat', 'Do NOT move if spine injury suspected'] },
  seizure: { severity: 'high', steps: ['Clear area of dangerous objects', 'Cushion the head', 'Turn person on their side (recovery position)', 'Time the seizure', 'Stay with person until fully conscious'], when_to_call_911: 'Seizure lasts over 5 minutes, first seizure, breathing difficulty after', do_not: ['Do NOT restrain the person', 'Do NOT put anything in mouth', 'Do NOT give food/drink until fully alert'] },
  heatstroke: { severity: 'high', steps: ['Move to cool area immediately', 'Remove excess clothing', 'Cool with water, fans, ice packs at neck/armpits/groin', 'Give cool water if conscious', 'Monitor body temperature'], when_to_call_911: 'Body temp above 104F/40C, confusion, loss of consciousness', do_not: ['Do NOT give aspirin/acetaminophen', 'Do NOT give ice-cold water to drink'] },
  allergic_reaction: { severity: 'high', steps: ['Identify and remove allergen if possible', 'Use epinephrine auto-injector if available', 'Help person sit up for breathing', 'Call 911 if anaphylaxis suspected', 'Give antihistamine for mild reactions'], when_to_call_911: 'Difficulty breathing, swelling of face/throat, dizziness, multiple body systems affected', do_not: ['Do NOT give food or drink if throat swelling', 'Do NOT wait to see if symptoms worsen'] },
}

const EMERGENCY_NUMBERS: Record<string, { police: string; ambulance: string; fire: string; universal: string }> = {
  us: { police: '911', ambulance: '911', fire: '911', universal: '911' },
  uk: { police: '999', ambulance: '999', fire: '999', universal: '112' },
  eu: { police: '112', ambulance: '112', fire: '112', universal: '112' },
  australia: { police: '000', ambulance: '000', fire: '000', universal: '112' },
  japan: { police: '110', ambulance: '119', fire: '119', universal: '110' },
  india: { police: '100', ambulance: '102', fire: '101', universal: '112' },
  china: { police: '110', ambulance: '120', fire: '119', universal: '110' },
}

const sg = settlegrid.init({
  toolSlug: 'first-aid',
  pricing: { defaultCostCents: 1, methods: {
    get_instructions: { costCents: 1, displayName: 'Get First Aid Instructions' },
    get_emergency_numbers: { costCents: 1, displayName: 'Get Emergency Numbers' },
    get_cpr_guide: { costCents: 1, displayName: 'Get CPR Guide' },
  }},
})

const getInstructions = sg.wrap(async (args: GetInstructionsInput) => {
  if (!args.condition) throw new Error('condition required')
  const key = args.condition.toLowerCase().replace(/ /g, '_')
  const data = CONDITIONS[key]
  if (!data) throw new Error(`Unknown condition. Available: ${Object.keys(CONDITIONS).join(', ')}`)
  return { condition: args.condition, ...data, disclaimer: 'For informational purposes only. Always call emergency services for serious injuries.' }
}, { method: 'get_instructions' })

const getEmergencyNumbers = sg.wrap(async (args: GetEmergencyInput) => {
  const country = (args.country ?? 'us').toLowerCase()
  const numbers = EMERGENCY_NUMBERS[country]
  if (!numbers) throw new Error(`Unknown country. Available: ${Object.keys(EMERGENCY_NUMBERS).join(', ')}`)
  return { country, ...numbers }
}, { method: 'get_emergency_numbers' })

const getCprGuide = sg.wrap(async (args: GetCprInput) => {
  const group = (args.age_group ?? 'adult').toLowerCase()
  const guides: Record<string, { rate: string; depth: string; ratio: string; steps: string[] }> = {
    adult: { rate: '100-120 compressions/min', depth: '2-2.4 inches (5-6 cm)', ratio: '30:2 (compressions:breaths)', steps: ['Check responsiveness', 'Call 911', 'Check breathing (10 sec max)', '30 chest compressions', '2 rescue breaths', 'Continue 30:2 until AED/EMS arrives'] },
    child: { rate: '100-120 compressions/min', depth: '2 inches (5 cm)', ratio: '30:2 (1 rescuer) or 15:2 (2 rescuers)', steps: ['Check responsiveness', '5 rescue breaths first', '30 chest compressions (one or two hands)', '2 rescue breaths', 'Call 911 after 2 minutes if alone', 'Continue until help arrives'] },
    infant: { rate: '100-120 compressions/min', depth: '1.5 inches (4 cm)', ratio: '30:2 (1 rescuer) or 15:2 (2 rescuers)', steps: ['Check responsiveness (tap foot)', '5 rescue breaths (cover mouth and nose)', '30 compressions with 2 fingers on sternum', '2 gentle breaths', 'Call 911 after 2 minutes if alone', 'Continue until help arrives'] },
  }
  const guide = guides[group]
  if (!guide) throw new Error(`Unknown age group. Available: ${Object.keys(guides).join(', ')}`)
  return { age_group: group, ...guide, disclaimer: 'Take a certified CPR course. This is informational only.' }
}, { method: 'get_cpr_guide' })

export { getInstructions, getEmergencyNumbers, getCprGuide }
console.log('settlegrid-first-aid MCP server ready')
console.log('Methods: get_instructions, get_emergency_numbers, get_cpr_guide')
console.log('Pricing: 1c per call | Powered by SettleGrid')
