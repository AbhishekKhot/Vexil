require_relative '../lib/vexil'

# 1. Initialize the client
vexil = Vexil::Client.new(
  api_key: 'your_local_dev_key', # Replace this with a real key from the dashboard
  base_url: 'http://localhost:3000'
)

puts 'Fetching flags for user context...'

begin
  # 2. Fetch flags (supports targeting context)
  flags = vexil.fetch_flags(
    user_id: 'user_123',
    country: 'US',
    beta_user: true
  )

  puts "Flags fetched successfully: #{flags.keys.join(', ')}"

  # 3. Check flags
  is_dark_mode_enabled = vexil.enabled?('dark-mode')
  puts "Is dark-mode enabled? #{is_dark_mode_enabled}"

  banner_text = vexil.value('banner-text')
  puts "Banner text: #{banner_text || 'N/A'}"

  # 4. Optional: Track evaluation event
  puts 'Tracking evaluation event...'
  vexil.track_events([{
    flag_key: 'dark-mode',
    result: is_dark_mode_enabled,
    context: { user_id: 'user_123' },
    timestamp: Time.now.iso8601
  }])

  puts 'Demo finished!'

rescue Vexil::AuthError => e
  warn "Authentication failed: #{e.message}"
rescue Vexil::NetworkError => e
  warn "Network failed: #{e.message}"
rescue StandardError => e
  warn "Demo failed: #{e.message}"
end
