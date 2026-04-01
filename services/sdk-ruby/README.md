# Vexil Ruby SDK

A lightweight, zero-dependency Ruby client for Vexil Feature Flags.

## Installation

Copy the `lib/vexil.rb` file to your project and require it.

```ruby
require_relative 'lib/vexil'
```

## Usage

```ruby
# 1. Initialize the client
vexil = Vexil::Client.new(
  api_key: 'vex_your_api_key',
  base_url: 'http://localhost:3000'
)

# 2. Fetch flags (supports targeting context)
vexil.fetch_flags(
  user_id: '123',
  country: 'US',
  plan: 'premium'
)

# 3. Check flags
if vexil.enabled?('new-header')
  puts "User has the new header!"
end

# Get rich values
theme = vexil.value('theme-color') # 'blue'
```

## Analytics

Evaluation events can be tracked manually.

```ruby
vexil.track_events([
  { flag_key: 'new-header', result: true, context: { user_id: '123' } }
])
```
