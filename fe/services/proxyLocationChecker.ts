import axios from 'axios';
import { ProxyItem } from '../types';

/**
 * Check proxy location từ proxy IP bằng cách query IP geolocation API
 * Không cần kết nối qua proxy, chỉ cần query IP của proxy
 */
export const checkProxyLocation = async (proxy: ProxyItem): Promise<{ location: string; country?: string; city?: string }> => {
  if (!proxy.ip || !proxy.port) {
    return { location: 'Unknown' };
  }

  try {
    // Query IP geolocation API để lấy location từ IP của proxy
    const response = await axios.get(`http://ip-api.com/json/${proxy.ip}`, {
      timeout: 10000,
      params: {
        fields: 'status,message,country,countryCode,city,region,regionName,timezone,query'
      }
    });

    if (response.data && response.data.status === 'success') {
      const { country, city, regionName } = response.data;
      
      // Format location: "Country - City" hoặc "Country" nếu không có city
      let location = '';
      if (country && city) {
        location = `${country} - ${city}`;
      } else if (country) {
        location = country;
      } else {
        location = 'Unknown';
      }

      return {
        location,
        country: country || undefined,
        city: city || undefined
      };
    }

    return { location: 'Unknown' };
  } catch (error: any) {
    console.error('[ProxyLocationChecker] Error checking proxy location:', error.message);
    // Fallback: thử API khác nếu ip-api.com fail
    try {
      const response = await axios.get(`https://ipapi.co/${proxy.ip}/json/`, {
        timeout: 10000
      });

      if (response.data && !response.data.error) {
        const { country_name, city } = response.data;
        let location = '';
        if (country_name && city) {
          location = `${country_name} - ${city}`;
        } else if (country_name) {
          location = country_name;
        } else {
          location = 'Unknown';
        }

        return {
          location,
          country: country_name || undefined,
          city: city || undefined
        };
      }
    } catch (fallbackError: any) {
      console.error('[ProxyLocationChecker] Fallback API also failed:', fallbackError.message);
    }

    return { location: 'Unknown' };
  }
};

