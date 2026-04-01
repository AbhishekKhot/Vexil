require 'net/http'
require 'uri'
require 'json'

module Vexil
  class Error < StandardError; end
  class AuthError < Error; end
  class NetworkError < Error; end

  class Client
    def initialize(api_key:, base_url:)
      @api_key = api_key
      @base_url = base_url.chomp('/')
      @flags = {}
    end

    def fetch_flags(context = {})
      uri = URI.parse("#{@base_url}/v1/eval")
      request = Net::HTTP::Post.new(uri)
      request['Authorization'] = "Bearer #{@api_key}"
      request['Content-Type'] = 'application/json'
      request.body = { context: context }.to_json

      begin
        response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
          http.request(request)
        end

        case response.code.to_i
        when 200
          @flags = JSON.parse(response.body)['flags'] || {}
        when 401
          raise AuthError, "Invalid API Key"
        else
          raise Error, "Server returned error: #{response.code} - #{response.body}"
        end
      rescue SocketError, Errno::ECONNREFUSED => e
        raise NetworkError, "Failed to connect to Vexil server at #{@base_url}: #{e.message}"
      rescue JSON::ParserError => e
        raise Error, "Failed to parse Vexil response: #{e.message}"
      end
      @flags
    end

    def enabled?(key)
      flag = @flags[key]
      return false unless flag
      flag['value'] == true
    end

    def value(key, default = nil)
      flag = @flags[key]
      return default unless flag
      flag['value']
    end

    def details(key)
      @flags[key] || nil
    end

    # Simple tracking of evaluation events for analytics
    def track_events(events)
      uri = URI.parse("#{@base_url}/v1/events")
      request = Net::HTTP::Post.new(uri)
      request['Authorization'] = "Bearer #{@api_key}"
      request['Content-Type'] = 'application/json'
      request.body = events.to_json

      begin
        Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
          http.request(request)
        end
      rescue => e
        # Analytics should be fire-and-forget; don't raise errors in main app flow
        warn "[Vexil] Failed to track events: #{e.message}"
      end
    end
  end
end
