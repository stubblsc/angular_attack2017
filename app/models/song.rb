class Song < ApplicationRecord
  belongs_to :user, inverse_of: :songs
  has_many :comments, inverse_of: :song
end
