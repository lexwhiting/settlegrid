/**
 * settlegrid-animal-facts — Animal Facts MCP Server
 *
 * Provides animal facts with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   random_fact()                         (1¢)
 *   get_facts(animal)                     (1¢)
 *   list_animals()                        (1¢)
 *   random_image(animal)                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface AnimalInput { animal: string }

const USER_AGENT = "settlegrid-animal-facts/1.0 (contact@settlegrid.ai)"

const ANIMAL_FACTS: Record<string, string[]> = {
  dog: ["Dogs have a sense of time and can tell how long you've been gone.", "A dog's nose print is unique, like a fingerprint.", "Dogs can learn more than 1,000 words."],
  cat: ["Cats spend 70% of their lives sleeping.", "A cat can rotate their ears 180 degrees.", "Cats have over 20 vocalizations including the purr."],
  elephant: ["Elephants are the only animals that can't jump.", "Elephants can hear through their feet.", "An elephant's trunk has over 40,000 muscles."],
  dolphin: ["Dolphins sleep with one eye open.", "Dolphins have names for each other.", "A dolphin's brain is larger than a human's."],
  octopus: ["An octopus has three hearts.", "Octopuses have blue blood.", "Each octopus arm has its own 'mind'."],
  penguin: ["Penguins can drink salt water.", "Emperor penguins can dive to 1,800 feet.", "Penguins propose with pebbles."],
  bear: ["Polar bear fur is actually transparent, not white.", "Bears can run up to 35 mph.", "Grizzly bears have a bite strong enough to crush a bowling ball."],
  owl: ["Owls can rotate their heads 270 degrees.", "A group of owls is called a parliament.", "Owls don't have eyeballs - they have eye tubes."],
  shark: ["Sharks have been around longer than trees.", "Some sharks can glow in the dark.", "Whale sharks have over 3,000 teeth."],
  bee: ["Bees can recognize human faces.", "A single bee colony can produce 60-100 pounds of honey per year.", "Bees communicate through dance."],
}

const ALL_ANIMALS = Object.keys(ANIMAL_FACTS)

const sg = settlegrid.init({
  toolSlug: "animal-facts",
  pricing: {
    defaultCostCents: 1,
    methods: {
      random_fact: { costCents: 1, displayName: "Get a random animal fact" },
      get_facts: { costCents: 1, displayName: "Get facts about specific animal" },
      list_animals: { costCents: 1, displayName: "List available animals" },
      random_image: { costCents: 1, displayName: "Get random animal image" },
    },
  },
})

const randomFact = sg.wrap(async () => {
  const animal = ALL_ANIMALS[Math.floor(Math.random() * ALL_ANIMALS.length)]
  const facts = ANIMAL_FACTS[animal]
  const fact = facts[Math.floor(Math.random() * facts.length)]
  return { animal, fact }
}, { method: "random_fact" })

const getFacts = sg.wrap(async (args: AnimalInput) => {
  if (!args.animal || typeof args.animal !== "string") throw new Error("animal is required")
  const key = args.animal.toLowerCase()
  const facts = ANIMAL_FACTS[key]
  if (!facts) throw new Error(`No facts for "${args.animal}". Available: ${ALL_ANIMALS.join(", ")}`)
  return { animal: args.animal, count: facts.length, facts }
}, { method: "get_facts" })

const listAnimals = sg.wrap(async () => {
  return { count: ALL_ANIMALS.length, animals: ALL_ANIMALS.map((a) => ({ name: a, fact_count: ANIMAL_FACTS[a].length })) }
}, { method: "list_animals" })

const randomImage = sg.wrap(async (args: AnimalInput) => {
  if (!args.animal || typeof args.animal !== "string") throw new Error("animal is required")
  const res = await fetch(`https://source.unsplash.com/400x300/?${encodeURIComponent(args.animal)}`, {
    redirect: "follow", headers: { "User-Agent": USER_AGENT },
  })
  return { animal: args.animal, image_url: res.url, source: "unsplash" }
}, { method: "random_image" })

export { randomFact, getFacts, listAnimals, randomImage }

console.log("settlegrid-animal-facts MCP server ready")
console.log("Methods: random_fact, get_facts, list_animals, random_image")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
