<template>
  <div class="product-container">
    <div class="product-card">
      <!-- <img :src="product.images[0].url" :alt="product.productName" class="product-image" /> -->
      <img
        v-if="product.images && product.images.length > 0"
        :src="product.images[0].url"
        :alt="product.productName"
        class="product-image"
      />
      <div class="product-details">
        <h3 class="product-name">{{ product.productName }}</h3>
        <p class="product-price">{{ product.price }}원</p>
        <p class="product-description">{{ product.summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
})

const product = ref({
  productName: '',
  price: 0,
  summary: '',
  images: [],
})

const VITE_API_SERVER_URI = import.meta.env.VITE_API_SERVER_URI

const getProduct = async () => {
  const response = await fetch(`${VITE_API_SERVER_URI}/api/project/${props.roomId}`)

  try {
    if (response.ok) {
      const project_info = await response.json()
      console.log('상품 정보 로드 성공', project_info)
      product.value = project_info
      console.log('product:', product.value.images[0].url)
    }
  } catch (error) {
    console.error('채팅 히스토리 로드 실패:', error)
  }
}

onMounted(() => {
  getProduct()
})
</script>

<style scoped>
.product-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
}

.product-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 0.25rem;
}

.product-details {
  flex: 1;
}

.product-name {
  margin: 0 0 0.5rem 0;
}

.product-price {
  font-weight: bold;
  color: #007bff;
  margin: 0 0 0.5rem 0;
}

.product-description {
  margin: 0;
  color: #6c757d;
}
</style>
