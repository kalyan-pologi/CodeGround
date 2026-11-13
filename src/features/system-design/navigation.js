const group = (title, ids) => ({ title, ids });

export const systemDesignNavigation = [
  { title: 'Getting started', links: ['home', 'envelope', 'delivery'] },
  { title: 'Core concepts', groups: [
    group('Networking Essentials', ['dns', 'tcp', 'clientserver', 'cdn', 'loadbalancing', 'proxy']),
    group('API Design', ['apidesign', 'apigateway', 'apigw', 'auth', 'restgraphql', 'ratelimit']),
    group('Data Modeling', ['normalization', 'schema', 'consistency', 'isolation', 'acid', 'sqlnosql']),
    group('Caching', ['caching', 'cacheeviction', 'cachestrategies', 'distrcache']),
    group('Sharding', ['sharding', 'shardstrats', 'partitioning']),
    group('Consistent Hashing', ['hashing', 'bloomfilter']),
    group('CAP Theorem', ['cap', 'pacelc', 'availability']),
    group('Database Indexing', ['indexing', 'indextypes', 'btree']),
    group('Replication', ['replication', 'repliclag']),
    group('Message Queues & Async', ['kafka', 'queues', 'rabbitmq', 'pubsub']),
    group('Distributed Systems', ['distrlog', 'distrtx', 'gossip', 'leaderelection', 'merkle']),
    group('Scalability & Reliability', ['autoscaling', 'backpressure', 'circuitbreaker', 'disaster', 'faulttolerance', 'hotspots', 'monitoring']),
    group('Storage', ['dfs', 'dynamodb', 'kvstore', 'postgres', 'storagetypes'])
  ]},
  { title: 'Key technologies', groups: [
    group('Databases', ['cassandra', 'dynamodb', 'postgres', 'sqlnosql']),
    group('Streaming & Search', ['flink', 'elastic', 'realtime']),
    group('Infrastructure', ['kubernetes', 'nginx'])
  ]},
  { title: 'Patterns', groups: [group('All Patterns', ['p-blobs', 'p-contention', 'p-dedup', 'p-fanout', 'p-geo', 'p-longtasks', 'p-multistep', 'p-notification', 'p-ratelimit', 'p-realtime', 'p-scalereads', 'p-scalewrites', 'p-search', 'p-topk'])]},
  { title: 'Question breakdowns', groups: [
    group('Storage & Retrieval', ['q-dropbox', 'q-gdocs', 'q-s3', 'q-bitly']),
    group('Social & Messaging', ['q-fb-feed', 'q-fb-live', 'q-fb-search', 'q-instagram', 'q-whatsapp', 'q-chatgpt']),
    group('Video & Media', ['q-youtube', 'q-youtube-topk', 'q-netflix']),
    group('Maps & Logistics', ['q-crawler', 'q-delivery', 'q-uber', 'q-tinder']),
    group('Finance & Commerce', ['q-adclick', 'q-auction', 'q-payment', 'q-price']),
    group('Dev Tools & Infra', ['q-ticketmaster', 'q-news', 'q-metrics', 'q-ratelimiter']),
    group('AI & Collaboration', ['q-leetcode', 'q-robinhood', 'q-strava', 'q-yelp'])
  ]}
];
