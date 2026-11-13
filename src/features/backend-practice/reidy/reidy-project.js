const property = 'projects/reidy/services/property-service/src/main/java/com/reidy/property/';
const appraisal = 'projects/reidy/services/appraisal-service/src/main/java/com/reidy/appraisal/';
const communication = 'projects/reidy/services/communication-service/src/main/java/com/reidy/communication/';
const platform = 'projects/reidy/shared/platform-common/src/main/java/com/reidy/platform/';

export const reidyProjectRoot = 'projects/reidy';

export const reidyProjectFiles = {
  'n-plus-one': [property + 'service/PropertyService.java', property + 'repository/PropertyRepository.java', property + 'entity/Property.java'],
  'missing-index': [property + 'repository/PropertyRepository.java', property + 'entity/Property.java'],
  'slow-pagination': [property + 'controller/PropertyController.java', property + 'service/PropertyService.java', property + 'repository/PropertyRepository.java'],
  'deadlocks': [appraisal + 'service/PaidAppraisalStore.java', appraisal + 'repository/CreditAccountRepository.java', appraisal + 'entity/CreditAccount.java'],
  'lock-timeouts': [appraisal + 'service/PaidAppraisalStore.java', appraisal + 'repository/CreditAccountRepository.java'],
  'retry-storms': [platform + 'config/ResilienceConfig.java', appraisal + 'provider/ResilientRentalDataClient.java'],
  'cache-stampede': [appraisal + 'service/RentalCacheStore.java', appraisal + 'config/RentalCacheProperties.java', appraisal + 'provider/CachingRentalDataClient.java'],
  'stale-cache-race': [appraisal + 'provider/CachingRentalDataClient.java', appraisal + 'service/RentalCacheStore.java', appraisal + 'repository/RentalCacheLockRepository.java'],
  'out-of-order-events': [platform + 'messaging/KafkaEventPublisher.java', 'projects/reidy/shared/contracts/src/main/java/com/reidy/contracts/event/PlatformEvent.java'],
  'outbox-backlog': [platform + 'service/NotificationOutboxWorker.java', platform + 'entity/NotificationOutbox.java', platform + 'repository/NotificationOutboxRepository.java'],
  'thread-pool-exhaustion': [platform + 'config/AsyncConfig.java', platform + 'service/NotificationOutboxWorker.java'],
  'failed-deployment': ['projects/reidy/Dockerfile', 'projects/reidy/compose.yml', property + 'PropertyApplication.java'],
  'paid-free-boundary': [appraisal + 'service/DefaultFreeAppraisalService.java', appraisal + 'service/DefaultPaidAppraisalService.java', appraisal + 'service/PaidAppraisalStore.java'],
  'pdf-download-config': [appraisal + 'config/RuntimeSettingsValidator.java', appraisal + 'controller/AppraisalController.java'],
  'billing-history-gap': [appraisal + 'service/PaidAppraisalStore.java', appraisal + 'repository/AppraisalHistoryRepository.java', appraisal + 'entity/AppraisalHistory.java'],
  'land-schema-normalization': [appraisal + 'mapper/ValuationNormalizer.java', appraisal + 'dto/NormalizedAppraisal.java'],
  'replace-comps': [appraisal + 'service/DefaultFreeAppraisalService.java', appraisal + 'repository/AppraisalCacheRepository.java'],
  'cache-decorator': [appraisal + 'provider/CachingRentalDataClient.java', appraisal + 'provider/RentalDataClient.java'],
  'cache-kill-switch': [appraisal + 'config/RentalCacheProperties.java', appraisal + 'config/RentalTransportConfig.java'],
  'chat-query-latency': [communication + 'service/ChatService.java', communication + 'repository/ChatMessageRepository.java', communication + 'repository/ConversationRepository.java'],
  'startup-observability': [platform + 'config/ProductionEnvironmentGuard.java', platform + 'config/RequestLoggingFilter.java'],
  'notification-template-invalidation': [communication + 'service/NotificationTemplateService.java', communication + 'repository/NotificationTemplateRepository.java', communication + 'messaging/NotificationKafkaListener.java']
};

export function projectFilesForScenario(scenarioId) {
  return reidyProjectFiles[scenarioId] || [];
}
