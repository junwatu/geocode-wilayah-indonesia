import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import geografis from 'geografis';


// Fungsi untuk mencari data kota dari OSM menggunakan Nominatim API
async function cariKotaOSM(namaKota, provinsi) {
  try {
    // Format query untuk pencarian yang lebih spesifik dengan menambahkan "Indonesia" dan provinsi
    const query = `${namaKota}, ${provinsi}, Indonesia`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=id`;
    
    // Tambahkan header User-Agent sesuai kebijakan Nominatim
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'KabupatenKotaGeocoder/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Jika ada hasil, kembalikan koordinat
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        source: 'OSM'
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error mencari data OSM untuk ${namaKota}: ${error.message}`);
    return null;
  }
}

// Fungsi untuk mencari data kota berdasarkan nama dari paket geografis
function cariKotaGeografis(namaKota) {
  // Ambil semua data dari paket geografis
  const data = geografis.dump();
  // Filter data berdasarkan nama kota (pastikan format huruf sama, misalnya menggunakan lower case)
  const hasil = data.filter(item => item.city && item.city.toLowerCase() === namaKota.toLowerCase());
  
  // Mengambil data unik (misalnya berdasarkan kode kota)
  const kotaUnik = [...new Map(hasil.map(item => [item.code.substring(0, 5), item])).values()];
  
  // Kembalikan data yang berisi nama kota, provinsi, dan koordinat
  return kotaUnik.map(item => ({
    code: item.code.substring(0, 5),
    province: item.province,
    city: item.city,
    latitude: item.latitude,
    longitude: item.longitude,
    source: 'geografis'
  }));
}

// Fungsi untuk mendapatkan nama provinsi berdasarkan ID
function getNamaProvinsi(provinceId) {
  const provinsiMap = {
    '11': 'Aceh',
    '12': 'Sumatera Utara',
    '13': 'Sumatera Barat',
    '14': 'Riau',
    '15': 'Jambi',
    '16': 'Sumatera Selatan',
    '17': 'Bengkulu',
    '18': 'Lampung',
    '19': 'Kepulauan Bangka Belitung',
    '21': 'Kepulauan Riau',
    '31': 'DKI Jakarta',
    '32': 'Jawa Barat',
    '33': 'Jawa Tengah',
    '34': 'Daerah Istimewa Yogyakarta',
    '35': 'Jawa Timur',
    '36': 'Banten',
    '51': 'Bali',
    '52': 'Nusa Tenggara Barat',
    '53': 'Nusa Tenggara Timur',
    '61': 'Kalimantan Barat',
    '62': 'Kalimantan Tengah',
    '63': 'Kalimantan Selatan',
    '64': 'Kalimantan Timur',
    '65': 'Kalimantan Utara',
    '71': 'Sulawesi Utara',
    '72': 'Sulawesi Tengah',
    '73': 'Sulawesi Selatan',
    '74': 'Sulawesi Tenggara',
    '75': 'Gorontalo',
    '76': 'Sulawesi Barat',
    '81': 'Maluku',
    '82': 'Maluku Utara',
    '91': 'Papua',
    '92': 'Papua Barat',
    '93': 'Papua Selatan',
    '94': 'Papua Tengah',
    '95': 'Papua Pegunungan',
    '96': 'Papua Barat Daya'
  };
  
  return provinsiMap[provinceId] || 'Indonesia';
}

// Fungsi utama untuk mencari data kota
async function cariData() {
  // Array untuk menyimpan semua hasil pencarian
  const hasilPencarian = [];
  
  // Baca file CSV
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream('kabupaten-kota_rows.csv')
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  
  // Proses setiap baris dengan delay untuk menghindari rate limiting dari OSM
  for (const row of rows) {
    const id = row.id;
    const namaKota = row.name;
    const provinceId = row.province_id;
    const namaProvinsi = getNamaProvinsi(provinceId);
    
    // Coba cari dari paket geografis dulu
    const dataKotaGeografis = cariKotaGeografis(namaKota);
    
    if (dataKotaGeografis.length > 0) {
      console.log(`Kota: ${namaKota} (dari geografis)`);
      dataKotaGeografis.forEach(item => {
        console.log(`  Provinsi: ${item.province}`);
        console.log(`  Latitude: ${item.latitude}, Longitude: ${item.longitude}`);
        
        hasilPencarian.push({
          id: id,
          name: namaKota,
          province_id: provinceId,
          latitude: item.latitude,
          longitude: item.longitude,
          source: item.source
        });
      });
    } else {
      // Jika tidak ditemukan di geografis, coba cari di OSM
      console.log(`Mencari "${namaKota}" di OSM...`);
      const dataOSM = await cariKotaOSM(namaKota, namaProvinsi);
      
      if (dataOSM) {
        console.log(`Kota: ${namaKota} (dari OSM)`);
        console.log(`  Provinsi: ${namaProvinsi}`);
        console.log(`  Latitude: ${dataOSM.latitude}, Longitude: ${dataOSM.longitude}`);
        
        hasilPencarian.push({
          id: id,
          name: namaKota,
          province_id: provinceId,
          latitude: dataOSM.latitude,
          longitude: dataOSM.longitude,
          source: dataOSM.source
        });
      } else {
        console.log(`Koordinat untuk kota "${namaKota}" tidak ditemukan.`);
        
        hasilPencarian.push({
          id: id,
          name: namaKota,
          province_id: provinceId,
          latitude: '',
          longitude: '',
          source: ''
        });
      }
      
      // Tambahkan delay untuk menghindari rate limiting dari OSM API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Tulis hasil pencarian ke file CSV baru
  const csvWriter = createObjectCsvWriter({
    path: 'kabupaten-kota-dengan-koordinat.csv',
    header: [
      {id: 'id', title: 'id'},
      {id: 'name', title: 'name'},
      {id: 'province_id', title: 'province_id'},
      {id: 'latitude', title: 'latitude'},
      {id: 'longitude', title: 'longitude'},
      {id: 'source', title: 'source'}
    ]
  });
  
  await csvWriter.writeRecords(hasilPencarian);
  console.log('Proses CSV selesai. Hasil disimpan di kabupaten-kota-dengan-koordinat.csv');
}

// Jalankan fungsi utama
cariData().catch(error => {
  console.error('Error:', error);
});
