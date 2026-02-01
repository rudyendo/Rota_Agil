// ==========================================
// SCRIPT PARA GEOCODIFICAR TODOS OS CLIENTES
// ==========================================
// Cole no console (F12) do seu app
// Vai processar automaticamente todos os 214 clientes
// Tempo estimado: 214 segundos (~3.5 minutos)
// ==========================================

async function geocodificarTodosOsClientes() {
  console.log('🚀 Iniciando geocodificação de todos os clientes...');
  
  // Pega clientes do localStorage
  const clientesStr = localStorage.getItem('cosmo_customers');
  if (!clientesStr) {
    console.error('❌ Nenhum cliente encontrado');
    return;
  }
  
  const clientes = JSON.parse(clientesStr);
  const semCoordenadas = clientes.filter(c => !c.latitude || !c.longitude);
  
  console.log(`📊 Total de clientes: ${clientes.length}`);
  console.log(`📍 Clientes sem coordenadas: ${semCoordenadas.length}`);
  console.log(`⏱️ Tempo estimado: ${Math.ceil(semCoordenadas.length / 60)} minutos\n`);
  
  if (semCoordenadas.length === 0) {
    console.log('✅ Todos os clientes já têm coordenadas!');
    return;
  }
  
  let processados = 0;
  let sucessos = 0;
  let falhas = 0;
  
  for (const cliente of semCoordenadas) {
    const endereco = `${cliente.address}, ${cliente.city || 'Natal'}, ${cliente.state || 'RN'}, Brasil`;
    
    try {
      // Aguarda 1 segundo entre requisições (rate limit)
      if (processados > 0) {
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.append('q', endereco);
      url.searchParams.append('format', 'json');
      url.searchParams.append('limit', '1');
      
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'RotaAgil/1.0' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          cliente.latitude = parseFloat(data[0].lat);
          cliente.longitude = parseFloat(data[0].lon);
          sucessos++;
          console.log(`✅ ${processados + 1}/${semCoordenadas.length} - ${cliente.name.substring(0, 30)}`);
        } else {
          falhas++;
          console.warn(`⚠️ ${processados + 1}/${semCoordenadas.length} - ${cliente.name.substring(0, 30)} (não encontrado)`);
        }
      } else {
        falhas++;
        console.error(`❌ ${processados + 1}/${semCoordenadas.length} - Erro ${response.status}`);
      }
      
    } catch (error) {
      falhas++;
      console.error(`❌ ${processados + 1}/${semCoordenadas.length} - ${cliente.name}: ${error.message}`);
    }
    
    processados++;
    
    // Salva progresso a cada 10 clientes
    if (processados % 10 === 0) {
      localStorage.setItem('cosmo_customers', JSON.stringify(clientes));
      console.log(`💾 Progresso salvo (${processados}/${semCoordenadas.length})`);
    }
  }
  
  // Salva resultado final
  localStorage.setItem('cosmo_customers', JSON.stringify(clientes));
  
  console.log('\n========================================');
  console.log('🎉 GEOCODIFICAÇÃO CONCLUÍDA!');
  console.log('========================================');
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);
  console.log(`📊 Taxa de sucesso: ${((sucessos / semCoordenadas.length) * 100).toFixed(1)}%`);
  console.log('🔄 Recarregue a página (F5) para aplicar');
  console.log('========================================\n');
}

// EXECUTA
geocodificarTodosOsClientes();
