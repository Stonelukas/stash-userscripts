# AutomateStash Suite - API Documentation

## Overview

The AutomateStash Suite integrates with multiple APIs to provide comprehensive automation capabilities. This document covers the Stash GraphQL API, external scraper APIs, and the internal API structure of the suite.

## Table of Contents

1. [Stash GraphQL API](#stash-graphql-api)
2. [External APIs](#external-apis)
3. [Internal APIs](#internal-apis)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

## Stash GraphQL API

The primary API for interacting with Stash server.

### Endpoint
```
http://localhost:9998/graphql
```

### Core Queries

#### Get Scene Details
```graphql
query FindScene($id: ID!) {
  findScene(id: $id) {
    id
    title
    details
    date
    rating
    organized
    urls
    stash_ids {
      endpoint
      stash_id
    }
    performers {
      id
      name
      image_path
    }
    studio {
      id
      name
      image_path
    }
    tags {
      id
      name
    }
    files {
      path
      size
      duration
      video_codec
      audio_codec
      width
      height
      frame_rate
      bit_rate
    }
  }
}
```

#### Search Performers
```graphql
query FindPerformers($filter: FindFilterType!) {
  findPerformers(filter: $filter) {
    count
    performers {
      id
      name
      aliases
      gender
      birthdate
      image_path
      scene_count
    }
  }
}
```

#### Get Scrapers
```graphql
query ListScrapers {
  listScrapers {
    id
    name
    scene {
      supported_scrapes
    }
    performer {
      supported_scrapes
    }
  }
}
```

### Core Mutations

#### Update Scene
```graphql
mutation SceneUpdate($input: SceneUpdateInput!) {
  sceneUpdate(input: $input) {
    id
    title
    details
    date
    rating
    organized
    performer_ids
    studio_id
    tag_ids
  }
}
```

#### Create Performer
```graphql
mutation PerformerCreate($input: PerformerCreateInput!) {
  performerCreate(input: $input) {
    id
    name
    aliases
    gender
    birthdate
    ethnicity
    country
    hair_color
    eye_color
    height
    measurements
    fake_tits
    career_length
    tattoos
    piercings
    twitter
    instagram
    image_path
  }
}
```

#### Create Studio
```graphql
mutation StudioCreate($input: StudioCreateInput!) {
  studioCreate(input: $input) {
    id
    name
    url
    parent_studio {
      id
      name
    }
    image_path
  }
}
```

#### Create Tag
```graphql
mutation TagCreate($input: TagCreateInput!) {
  tagCreate(input: $input) {
    id
    name
    aliases
    image_path
  }
}
```

#### Scrape Scene
```graphql
mutation ScrapeScene($scraper_id: ID!, $scene: SceneUpdateInput!) {
  scrapeSingleScene(source: $scraper_id, input: $scene) {
    title
    details
    date
    urls
    studio {
      stored_id
      name
      url
    }
    performers {
      stored_id
      name
      gender
      urls
    }
    tags {
      stored_id
      name
    }
  }
}
```

### Schema Types

#### SceneUpdateInput
```typescript
interface SceneUpdateInput {
  id: string;
  title?: string;
  details?: string;
  url?: string;
  date?: string;
  rating?: number;
  organized?: boolean;
  performer_ids?: string[];
  studio_id?: string;
  tag_ids?: string[];
  stash_ids?: StashID[];
}
```

#### PerformerCreateInput
```typescript
interface PerformerCreateInput {
  name: string;
  aliases?: string;
  gender?: GenderEnum;
  birthdate?: string;
  ethnicity?: string;
  country?: string;
  eye_color?: string;
  hair_color?: string;
  height?: number;
  measurements?: string;
  fake_tits?: string;
  career_length?: string;
  tattoos?: string;
  piercings?: string;
  url?: string;
  twitter?: string;
  instagram?: string;
  image?: string;
}
```

#### StudioCreateInput
```typescript
interface StudioCreateInput {
  name: string;
  url?: string;
  parent_id?: string;
  image?: string;
  stash_ids?: StashID[];
}
```

## External APIs

### StashDB API

StashDB is the community metadata database for Stash.

#### Endpoint
```
https://stashdb.org/graphql
```

#### Authentication
Uses API key in headers:
```javascript
headers: {
  'ApiKey': 'your-stashdb-api-key'
}
```

#### Scene Lookup
```graphql
query FindSceneByFingerprint($fingerprint: String!) {
  findSceneByFingerprint(fingerprint: $fingerprint) {
    id
    title
    details
    date
    studios {
      name
      url
    }
    performers {
      name
      gender
      aliases
    }
    tags {
      name
      category
    }
  }
}
```

### ThePornDB API

ThePornDB provides adult content metadata.

#### Endpoint
```
https://metadataapi.net/api
```

#### Authentication
Uses Bearer token:
```javascript
headers: {
  'Authorization': 'Bearer your-api-token'
}
```

#### Scene Search
```http
GET /scenes/search?q={query}
```

Response:
```json
{
  "data": [
    {
      "id": "scene-id",
      "title": "Scene Title",
      "description": "Scene description",
      "date": "2024-01-01",
      "performers": [
        {
          "id": "performer-id",
          "name": "Performer Name"
        }
      ],
      "site": {
        "id": "site-id",
        "name": "Site Name"
      },
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

## Internal APIs

### GraphQLClient Class

The main class for interacting with Stash's GraphQL API.

```javascript
class GraphQLClient {
  constructor() {
    this.endpoint = `${getConfig(CONFIG.STASH_ADDRESS)}/graphql`;
    this.headers = this.buildHeaders();
  }

  /**
   * Execute a GraphQL query
   * @param {string} query - GraphQL query string
   * @param {object} variables - Query variables
   * @returns {Promise<object>} Query result
   */
  async query(query, variables = {}) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ query, variables })
    });
    
    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data;
  }

  /**
   * Execute a GraphQL mutation
   * @param {string} mutation - GraphQL mutation string
   * @param {object} variables - Mutation variables
   * @returns {Promise<object>} Mutation result
   */
  async mutation(mutation, variables = {}) {
    return this.query(mutation, variables);
  }

  /**
   * Get current scene ID from URL
   * @returns {string|null} Scene ID or null
   */
  getCurrentSceneId() {
    const match = window.location.pathname.match(/\/scenes\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch complete scene details
   * @param {string} id - Scene ID
   * @returns {Promise<object>} Scene details
   */
  async getSceneDetails(id) {
    const query = `
      query FindScene($id: ID!) {
        findScene(id: $id) {
          id
          title
          details
          date
          rating
          organized
          urls
          stash_ids {
            endpoint
            stash_id
          }
          performers {
            id
            name
          }
          studio {
            id
            name
          }
          tags {
            id
            name
          }
        }
      }
    `;
    
    const result = await this.query(query, { id });
    return result.findScene;
  }

  /**
   * Update scene metadata
   * @param {string} id - Scene ID
   * @param {object} input - Update input
   * @returns {Promise<object>} Updated scene
   */
  async updateScene(id, input) {
    const mutation = `
      mutation SceneUpdate($input: SceneUpdateInput!) {
        sceneUpdate(input: $input) {
          id
          title
          details
          organized
        }
      }
    `;
    
    const result = await this.mutation(mutation, {
      input: { id, ...input }
    });
    
    return result.sceneUpdate;
  }

  /**
   * Search for performers by name
   * @param {string} name - Performer name
   * @returns {Promise<array>} List of performers
   */
  async findPerformer(name) {
    const query = `
      query FindPerformers($filter: FindFilterType!) {
        findPerformers(filter: $filter) {
          performers {
            id
            name
            aliases
          }
        }
      }
    `;
    
    const result = await this.query(query, {
      filter: {
        q: name,
        per_page: 10
      }
    });
    
    return result.findPerformers.performers;
  }

  /**
   * Create a new performer
   * @param {object} input - Performer data
   * @returns {Promise<object>} Created performer
   */
  async createPerformer(input) {
    const mutation = `
      mutation PerformerCreate($input: PerformerCreateInput!) {
        performerCreate(input: $input) {
          id
          name
        }
      }
    `;
    
    const result = await this.mutation(mutation, { input });
    return result.performerCreate;
  }

  /**
   * Get available scrapers
   * @returns {Promise<array>} List of scrapers
   */
  async getScrapers() {
    const query = `
      query ListScrapers {
        listScrapers {
          id
          name
          scene {
            supported_scrapes
          }
        }
      }
    `;
    
    const result = await this.query(query);
    return result.listScrapers;
  }
}
```

### StatusTracker Class

Manages scene processing status and history.

```javascript
class StatusTracker {
  /**
   * Detect current scene status
   * @returns {Promise<object>} Status object
   */
  async detectCurrentStatus() {
    const sceneId = this.client.getCurrentSceneId();
    if (!sceneId) return {};
    
    const scene = await this.client.getSceneDetails(sceneId);
    
    return {
      hasStashDB: this.hasStashDBData(scene),
      hasThePornDB: this.hasThePornDBData(scene),
      isOrganized: scene.organized,
      hasPerformers: scene.performers?.length > 0,
      hasStudio: !!scene.studio,
      hasTags: scene.tags?.length > 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Check if scene has StashDB data
   * @param {object} scene - Scene object
   * @returns {boolean} Has StashDB data
   */
  hasStashDBData(scene) {
    return scene.stash_ids?.some(id => 
      id.endpoint.includes('stashdb.org')
    ) || false;
  }

  /**
   * Check if scene has ThePornDB data
   * @param {object} scene - Scene object
   * @returns {boolean} Has ThePornDB data
   */
  hasThePornDBData(scene) {
    return scene.urls?.some(url => 
      url.includes('theporndb.net')
    ) || false;
  }
}
```

## Authentication

### Stash Server Authentication

Configure in settings or via environment:

```javascript
// Via configuration
setConfig(CONFIG.STASH_ADDRESS, 'http://localhost:9998');
setConfig(CONFIG.STASH_API_KEY, 'your-api-key');

// Build headers
buildHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  const apiKey = getConfig(CONFIG.STASH_API_KEY);
  if (apiKey) {
    headers['ApiKey'] = apiKey;
  }
  
  return headers;
}
```

### External API Authentication

StashDB and ThePornDB require separate API keys:

```javascript
// StashDB
const stashDBHeaders = {
  'Content-Type': 'application/json',
  'ApiKey': 'stashdb-api-key'
};

// ThePornDB
const thePornDBHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer theporndb-token'
};
```

## Error Handling

### GraphQL Error Handling

```javascript
try {
  const result = await graphqlClient.query(query, variables);
  // Process result
} catch (error) {
  if (error.message.includes('GraphQL errors')) {
    // Handle GraphQL-specific errors
    const errors = JSON.parse(error.message.replace('GraphQL errors: ', ''));
    errors.forEach(err => {
      console.error(`Field: ${err.path}, Message: ${err.message}`);
    });
  } else if (error.message.includes('fetch')) {
    // Network error
    console.error('Network error:', error);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

### Retry Logic

```javascript
async function retryOperation(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// Usage
const scene = await retryOperation(() => 
  graphqlClient.getSceneDetails(sceneId)
);
```

## Rate Limiting

### Request Throttling

```javascript
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 1000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  
  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(time => 
      now - time < this.timeWindow
    );
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

// Usage
const rateLimiter = new RateLimiter(5, 1000); // 5 requests per second

async function makeRequest() {
  await rateLimiter.throttle();
  return graphqlClient.query(/* ... */);
}
```

## Examples

### Complete Scene Update Example

```javascript
async function updateSceneComplete() {
  const client = new GraphQLClient();
  const sceneId = client.getCurrentSceneId();
  
  try {
    // 1. Get current scene data
    const scene = await client.getSceneDetails(sceneId);
    
    // 2. Scrape from StashDB
    const stashDBData = await scrapeStashDB(scene);
    
    // 3. Create missing performers
    const performerIds = [];
    for (const performer of stashDBData.performers) {
      let performerId = await client.findPerformer(performer.name);
      
      if (!performerId) {
        const created = await client.createPerformer({
          name: performer.name,
          gender: performer.gender
        });
        performerId = created.id;
      }
      
      performerIds.push(performerId);
    }
    
    // 4. Update scene
    const updated = await client.updateScene(sceneId, {
      title: stashDBData.title,
      details: stashDBData.details,
      date: stashDBData.date,
      performer_ids: performerIds,
      organized: true
    });
    
    return updated;
    
  } catch (error) {
    console.error('Scene update failed:', error);
    throw error;
  }
}
```

### Bulk Operations Example

```javascript
async function bulkUpdateScenes(sceneIds, updates) {
  const client = new GraphQLClient();
  const results = [];
  
  for (const sceneId of sceneIds) {
    try {
      const result = await client.updateScene(sceneId, updates);
      results.push({ success: true, sceneId, result });
    } catch (error) {
      results.push({ success: false, sceneId, error: error.message });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
```

### Scraper Integration Example

```javascript
async function scrapeWithFallback(scene) {
  const scrapers = ['stashdb', 'theporndb'];
  let scrapedData = null;
  
  for (const scraper of scrapers) {
    try {
      if (scraper === 'stashdb') {
        scrapedData = await scrapeStashDB(scene);
      } else if (scraper === 'theporndb') {
        scrapedData = await scrapeThePornDB(scene);
      }
      
      if (scrapedData) break;
      
    } catch (error) {
      console.warn(`Scraper ${scraper} failed:`, error);
    }
  }
  
  return scrapedData;
}
```

## API Response Caching

```javascript
class APICache {
  constructor(ttl = 300000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  getCacheKey(query, variables) {
    return `${query}-${JSON.stringify(variables)}`;
  }
  
  get(query, variables) {
    const key = this.getCacheKey(query, variables);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  set(query, variables, data) {
    const key = this.getCacheKey(query, variables);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  clear() {
    this.cache.clear();
  }
}

// Usage with GraphQLClient
const cache = new APICache();

async function cachedQuery(query, variables) {
  const cached = cache.get(query, variables);
  if (cached) return cached;
  
  const result = await graphqlClient.query(query, variables);
  cache.set(query, variables, result);
  
  return result;
}
```

---

This API documentation provides comprehensive coverage of all APIs used by the AutomateStash Suite, including authentication, error handling, rate limiting, and practical examples for common operations.