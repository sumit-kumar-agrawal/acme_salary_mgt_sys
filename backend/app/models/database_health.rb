# Reports whether the primary database answers a trivial query.
# Used by the public health endpoint; kept separate so tests can force the down path.
class DatabaseHealth
  def self.up?
    ActiveRecord::Base.with_connection { |connection| connection.select_value("SELECT 1") }
    true
  rescue ActiveRecord::ActiveRecordError => e
    # Log the class only: driver messages can include host and user details.
    Rails.logger.warn("Database health check failed: #{e.class}")
    false
  end
end
