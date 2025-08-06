/**
 * GraphQL client for Stash API communication
 */

import { getConfig, CONFIG } from './config.js';
import { logError } from './utils.js';

export class GraphQLClient {
    constructor() {
        this.endpoint = null;
        this.apiKey = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        this.endpoint = await getConfig(CONFIG.STASH_ADDRESS) + '/graphql';
        this.apiKey = await getConfig(CONFIG.STASH_API_KEY);
        this.initialized = true;
    }

    async query(query, variables = {}) {
        if (!this.initialized) await this.init();
        
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (this.apiKey) {
                headers['ApiKey'] = this.apiKey;
            }

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.errors) {
                console.error('GraphQL errors:', data.errors);
                throw new Error(data.errors[0].message);
            }

            return data.data;
        } catch (error) {
            logError('GraphQL Query', error);
            throw error;
        }
    }

    // Common queries
    async findScene(id) {
        const query = `
            query FindScene($id: ID!) {
                findScene(id: $id) {
                    id
                    title
                    details
                    date
                    rating100
                    organized
                    studio {
                        id
                        name
                    }
                    performers {
                        id
                        name
                    }
                    tags {
                        id
                        name
                    }
                    files {
                        path
                        size
                        width
                        height
                        duration
                        video_codec
                        audio_codec
                        frame_rate
                        bit_rate
                    }
                    paths {
                        screenshot
                        preview
                        stream
                    }
                    scene_markers {
                        id
                        title
                        seconds
                    }
                    stash_ids {
                        stash_id
                        endpoint
                    }
                }
            }
        `;
        
        const result = await this.query(query, { id });
        return result.findScene;
    }

    async findScenes(filter = {}, options = {}) {
        const query = `
            query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType, $scene_ids: [Int!]) {
                findScenes(filter: $filter, scene_filter: $scene_filter, scene_ids: $scene_ids) {
                    count
                    scenes {
                        id
                        title
                        date
                        rating100
                        organized
                        studio {
                            id
                            name
                        }
                        performers {
                            id
                            name
                        }
                        tags {
                            id
                            name
                        }
                        files {
                            path
                            size
                        }
                        paths {
                            screenshot
                        }
                    }
                }
            }
        `;
        
        const variables = {
            filter: {
                q: filter.q || '',
                page: filter.page || 1,
                per_page: filter.per_page || 40,
                sort: filter.sort || 'date',
                direction: filter.direction || 'DESC'
            }
        };
        
        if (options.scene_filter) {
            variables.scene_filter = options.scene_filter;
        }
        
        if (options.scene_ids) {
            variables.scene_ids = options.scene_ids;
        }
        
        const result = await this.query(query, variables);
        return result.findScenes;
    }

    async findPerformers(filter = {}) {
        const query = `
            query FindPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
                findPerformers(filter: $filter, performer_filter: $performer_filter) {
                    count
                    performers {
                        id
                        name
                        disambiguation
                        gender
                        birthdate
                        country
                        ethnicity
                        hair_color
                        eye_color
                        height_cm
                        weight
                        measurements
                        fake_tits
                        career_length
                        tattoos
                        piercings
                        url
                        twitter
                        instagram
                        image_path
                        scene_count
                        rating100
                        details
                        death_date
                        tags {
                            id
                            name
                        }
                    }
                }
            }
        `;
        
        const variables = {
            filter: {
                q: filter.q || '',
                page: filter.page || 1,
                per_page: filter.per_page || 40,
                sort: filter.sort || 'name',
                direction: filter.direction || 'ASC'
            }
        };
        
        if (filter.performer_filter) {
            variables.performer_filter = filter.performer_filter;
        }
        
        const result = await this.query(query, variables);
        return result.findPerformers;
    }

    async findStudios(filter = {}) {
        const query = `
            query FindStudios($filter: FindFilterType) {
                findStudios(filter: $filter) {
                    count
                    studios {
                        id
                        name
                        url
                        image_path
                        scene_count
                        details
                        rating100
                        parent_studio {
                            id
                            name
                        }
                    }
                }
            }
        `;
        
        const variables = {
            filter: {
                q: filter.q || '',
                page: filter.page || 1,
                per_page: filter.per_page || 40,
                sort: filter.sort || 'name',
                direction: filter.direction || 'ASC'
            }
        };
        
        const result = await this.query(query, variables);
        return result.findStudios;
    }

    async findTags(filter = {}) {
        const query = `
            query FindTags($filter: FindFilterType) {
                findTags(filter: $filter) {
                    count
                    tags {
                        id
                        name
                        scene_count
                        description
                        image_path
                    }
                }
            }
        `;
        
        const variables = {
            filter: {
                q: filter.q || '',
                page: filter.page || 1,
                per_page: filter.per_page || 40,
                sort: filter.sort || 'name',
                direction: filter.direction || 'ASC'
            }
        };
        
        const result = await this.query(query, variables);
        return result.findTags;
    }

    // Mutation methods
    async updateScene(id, input) {
        const mutation = `
            mutation SceneUpdate($id: ID!, $input: SceneUpdateInput!) {
                sceneUpdate(id: $id, input: $input) {
                    id
                    title
                    organized
                }
            }
        `;
        
        const result = await this.query(mutation, { id, input });
        return result.sceneUpdate;
    }

    async bulkUpdateScenes(ids, input) {
        const mutation = `
            mutation BulkSceneUpdate($ids: [ID!]!, $input: BulkSceneUpdateInput!) {
                bulkSceneUpdate(ids: $ids, input: $input) {
                    id
                    title
                }
            }
        `;
        
        const result = await this.query(mutation, { ids, input });
        return result.bulkSceneUpdate;
    }

    // System queries
    async getStats() {
        const query = `
            query Stats {
                stats {
                    scene_count
                    image_count
                    gallery_count
                    performer_count
                    studio_count
                    tag_count
                    total_o_count
                    total_size
                    total_duration
                    scenes_played
                }
            }
        `;
        
        const result = await this.query(query);
        return result.stats;
    }

    async getSystemStatus() {
        const query = `
            query SystemStatus {
                systemStatus {
                    databaseSchema
                    databasePath
                    configPath
                }
            }
        `;
        
        const result = await this.query(query);
        return result.systemStatus;
    }

    async getJobQueue() {
        const query = `
            query JobQueue {
                jobQueue {
                    id
                    status
                    subTasks
                    description
                    progress
                    startTime
                    endTime
                    addTime
                    error
                }
            }
        `;
        
        const result = await this.query(query);
        return result.jobQueue;
    }
}

// Create singleton instance
export const graphqlClient = new GraphQLClient();