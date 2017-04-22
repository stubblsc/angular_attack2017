Rails.application.routes.draw do
  resources :comments
  resources :songs

  namespace :api do
      mount_devise_token_auth_for 'User', at: 'auth'
  end
  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
