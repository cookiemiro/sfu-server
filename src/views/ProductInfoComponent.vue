<template>
  <div class="product-container">
    <div v-for="product in products" :key="product.id" class="product-card">
      <img :src="product.image" :alt="product.name" class="product-image" />
      <div class="product-details">
        <h3 class="product-name">{{ product.name }}</h3>
        <p class="product-price">{{ product.price }}원</p>
        <p class="product-description">{{ product.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const products = ref([
  {
    id: 1,
    name: '상품 1',
    price: '29,900',
    description: '상품 설명입니다.',
    image: '/api/placeholder/100/100',
  },
  // 더 많은 상품 추가
])
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
